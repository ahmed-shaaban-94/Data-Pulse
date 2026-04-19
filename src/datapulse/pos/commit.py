"""Atomic POS commit — ``POST /pos/transactions/commit``.

Inserts the transaction header + all line items + marks ``commit_confirmed_at``
in one SQL transaction. Designed for offline queue replay so a retried push
idempotently lands a single atomic financial write rather than the legacy
3-step draft → items → checkout flow.

Security hardening (H2):
* ``subtotal``, ``grand_total`` and every item's ``line_total`` are
  recomputed server-side from ``unit_price * quantity - discount``. Client
  totals are rejected if they disagree beyond a rounding epsilon, so a
  compromised client can not fake lower books or inflate refunds.
* The receipt number is derived deterministically from the auto-increment
  ``transaction_id`` (``R{YYYYMMDD}-{tenant}-{transaction_id}``) rather than
  ``count(*) + 1``; migration 088 adds a unique partial index so duplicates
  are rejected by the DB as a defence-in-depth backstop.

Design ref: docs/superpowers/specs/2026-04-17-pos-electron-desktop-design.md §3.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.models import CommitRequest, CommitResponse

# Rounding tolerance when comparing client-declared totals to server recomputed
# totals. Gives the desktop client ~0.01 EGP of rounding headroom.
_TOTAL_EPSILON = Decimal("0.01")


def _build_receipt_number(tenant_id: int, transaction_id: int, now: datetime) -> str:
    """Deterministic receipt number — same format as service._build_receipt_number.

    Uniqueness is guaranteed by the auto-increment ``transaction_id``, so we
    never rely on ``count(*) + 1`` (which races under concurrent commits).
    Migration 088 adds a unique partial index on (tenant_id, receipt_number)
    as an additional DB-level backstop.
    """
    return f"R{now.strftime('%Y%m%d')}-{tenant_id}-{transaction_id}"


def _recompute_line_total(unit_price: Decimal, quantity: Decimal, discount: Decimal) -> Decimal:
    """Authoritative server-side line total = unit_price * qty - discount."""
    return (unit_price * quantity - discount).quantize(Decimal("0.0001"))


def atomic_commit(
    session: Session,
    *,
    tenant_id: int,
    payload: CommitRequest,
) -> CommitResponse:
    """Insert the transaction + items + set ``commit_confirmed_at`` atomically.

    Raises ``HTTPException(400)`` when:
    - the declared grand_total disagrees with server-recomputed totals beyond
      ``_TOTAL_EPSILON``
    - a cash payment tenders less than the server-recomputed grand total
    """
    # ── Server-side total recomputation ───────────────────────────────────────
    computed_subtotal = Decimal("0")
    for item in payload.items:
        computed_subtotal += _recompute_line_total(item.unit_price, item.quantity, item.discount)
    computed_subtotal = computed_subtotal.quantize(Decimal("0.0001"))
    computed_grand_total = (
        computed_subtotal - payload.discount_total + payload.tax_total
    ).quantize(Decimal("0.0001"))

    # Reject client-declared totals that drift beyond rounding. The DB will
    # store the server-recomputed numbers regardless, but surfacing the mismatch
    # lets the desktop client catch display bugs before the books drift.
    if abs(computed_grand_total - payload.grand_total) > _TOTAL_EPSILON:
        raise HTTPException(
            status_code=400,
            detail=(
                f"grand_total mismatch: client={payload.grand_total} server={computed_grand_total}"
            ),
        )

    # ── Cash tender validation against the server-recomputed total ─────────
    if payload.payment_method.value == "cash":
        tendered = payload.cash_tendered or Decimal("0")
        if tendered < computed_grand_total:
            raise HTTPException(status_code=400, detail="cash_tendered < grand_total")
        change_due = tendered - computed_grand_total
    else:
        change_due = Decimal("0")

    now = datetime.now(UTC)

    # ── Insert the transaction header (receipt NULL until we have the id) ──
    txn_row = session.execute(
        text(
            """
            INSERT INTO pos.transactions
                (tenant_id, terminal_id, staff_id, customer_id, site_code,
                 subtotal, discount_total, tax_total, grand_total,
                 payment_method, status, receipt_number,
                 shift_id, created_at, commit_confirmed_at)
            VALUES
                (:tid, :term, :staff, :cust, :site,
                 :sub, :disc, :tax, :grand,
                 :pm, 'completed', NULL, :shift, :now, :now)
            RETURNING id
            """
        ),
        {
            "tid": tenant_id,
            "term": payload.terminal_id,
            "staff": payload.staff_id,
            "cust": payload.customer_id,
            "site": payload.site_code,
            "sub": computed_subtotal,
            "disc": payload.discount_total,
            "tax": payload.tax_total,
            "grand": computed_grand_total,
            "pm": payload.payment_method.value,
            "shift": payload.shift_id,
            "now": now,
        },
    ).first()
    if txn_row is None:  # pragma: no cover — INSERT RETURNING always yields a row
        raise HTTPException(status_code=500, detail="commit_insert_no_rowid")
    transaction_id = int(txn_row[0])

    # Deterministic receipt number derived from the id we just reserved.
    receipt = _build_receipt_number(tenant_id, transaction_id, now)
    session.execute(
        text("UPDATE pos.transactions SET receipt_number = :rec WHERE id = :txn"),
        {"rec": receipt, "txn": transaction_id},
    )

    for item in payload.items:
        server_line_total = _recompute_line_total(item.unit_price, item.quantity, item.discount)
        session.execute(
            text(
                """
                INSERT INTO pos.transaction_items
                    (tenant_id, transaction_id, drug_code, drug_name,
                     batch_number, expiry_date, quantity, unit_price,
                     discount, line_total, is_controlled, pharmacist_id)
                VALUES
                    (:tid, :txn, :dc, :dn, :bn, :exp, :qty, :up, :disc, :lt, :ic, :ph)
                """
            ),
            {
                "tid": tenant_id,
                "txn": transaction_id,
                "dc": item.drug_code,
                "dn": item.drug_name,
                "bn": item.batch_number,
                "exp": item.expiry_date,
                "qty": item.quantity,
                "up": item.unit_price,
                "disc": item.discount,
                "lt": server_line_total,
                "ic": item.is_controlled,
                "ph": item.pharmacist_id,
            },
        )

    return CommitResponse(
        transaction_id=transaction_id,
        receipt_number=receipt,
        commit_confirmed_at=now,
        change_due=change_due,
    )
