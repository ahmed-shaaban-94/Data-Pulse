"""atomic_commit unit tests — mocked session only.

Covers:
* Happy-path commit + change-due calc
* Cash-insufficient 400
* Non-cash payment zero change
* Receipt number format (deterministic, id-derived)
* Server-side total recomputation (H2):
    - client-inflated grand_total rejected with 400
    - per-item line_total recomputed server-side
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from datapulse.pos.constants import PaymentMethod
from datapulse.pos.models import CommitRequest, PosCartItem

pytestmark = pytest.mark.unit


def _payload(
    *,
    total: str = "12.00",
    tendered: str | None = "20.00",
    payment_method: PaymentMethod = PaymentMethod.cash,
    items: list[PosCartItem] | None = None,
    declared_grand_total: str | None = None,
) -> CommitRequest:
    """Build a CommitRequest. ``declared_grand_total`` lets tests simulate a
    client whose declared total diverges from the item sum (the H2 attack
    surface)."""
    if items is None:
        items = [
            PosCartItem(
                drug_code="D",
                drug_name="Drug",
                quantity=Decimal("1"),
                unit_price=Decimal(total),
                line_total=Decimal(total),
            )
        ]
    return CommitRequest(
        terminal_id=1,
        shift_id=1,
        staff_id="s-1",
        site_code="S1",
        items=items,
        subtotal=Decimal(total),
        grand_total=Decimal(declared_grand_total if declared_grand_total else total),
        payment_method=payment_method,
        cash_tendered=Decimal(tendered) if tendered is not None else None,
    )


def _stub_session(returning_id: int) -> MagicMock:
    """Minimal MagicMock session: ``RETURNING id`` returns the configured id,
    other executes (the UPDATE + each item INSERT) are no-ops."""
    session = MagicMock()

    def _execute(stmt, params=None):  # noqa: ARG001
        sql = str(stmt)
        m = MagicMock()
        if "RETURNING id" in sql:
            m.first.return_value = (returning_id,)
        return m

    session.execute.side_effect = _execute
    return session


def test_atomic_commit_returns_response_with_change_due() -> None:
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=42)
    resp = atomic_commit(session, tenant_id=1, payload=_payload())

    assert resp.transaction_id == 42
    assert resp.receipt_number.startswith("R")
    assert "-1-42" in resp.receipt_number  # tenant-1, txn-42
    assert resp.change_due == Decimal("8.00")
    # Header INSERT + receipt UPDATE + 1 item INSERT = 3 execute calls.
    assert session.execute.call_count == 3


def test_atomic_commit_400_when_cash_insufficient() -> None:
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=42)
    with pytest.raises(HTTPException) as exc:
        atomic_commit(
            session,
            tenant_id=1,
            payload=_payload(total="50.00", tendered="10.00"),
        )
    assert exc.value.status_code == 400


def test_atomic_commit_non_cash_payment_zero_change() -> None:
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=7)
    resp = atomic_commit(
        session,
        tenant_id=1,
        payload=_payload(total="99.00", tendered=None, payment_method=PaymentMethod.card),
    )
    assert resp.change_due == Decimal("0")


def test_receipt_number_is_deterministic_from_id() -> None:
    """Regression for H2: the receipt number must include the transaction_id
    so concurrent commits can never collide (the count(*)+1 pattern could)."""
    from datapulse.pos.commit import _build_receipt_number

    now = datetime(2026, 4, 19, 12, 0, 0, tzinfo=UTC)
    rec = _build_receipt_number(tenant_id=3, transaction_id=123, now=now)
    assert rec == "R20260419-3-123"


def test_atomic_commit_rejects_inflated_client_grand_total() -> None:
    """The client sends one item for 10.00 but declares grand_total 9999.00.
    Server recomputes subtotal from items and refuses the commit."""
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=42)
    payload = _payload(
        total="10.00",
        declared_grand_total="9999.00",
        tendered="10000.00",
    )
    with pytest.raises(HTTPException) as exc:
        atomic_commit(session, tenant_id=1, payload=payload)
    assert exc.value.status_code == 400
    assert "grand_total mismatch" in str(exc.value.detail)


def test_atomic_commit_rejects_deflated_client_grand_total() -> None:
    """Mirror attack: client sends one item for 100.00 but declares
    grand_total 1.00 to understate the books. Must also be rejected."""
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=42)
    payload = _payload(
        total="100.00",
        declared_grand_total="1.00",
        tendered="100.00",
    )
    with pytest.raises(HTTPException) as exc:
        atomic_commit(session, tenant_id=1, payload=payload)
    assert exc.value.status_code == 400
    assert "grand_total mismatch" in str(exc.value.detail)


def test_atomic_commit_writes_server_computed_line_total() -> None:
    """The INSERT into transaction_items must use a server-recomputed
    line_total so a client sending line_total != unit_price*qty - discount
    can not corrupt the books."""
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=42)
    item = PosCartItem(
        drug_code="D",
        drug_name="Drug",
        quantity=Decimal("2"),
        unit_price=Decimal("50"),
        discount=Decimal("0"),
        line_total=Decimal("9999"),  # client-inflated
    )
    payload = _payload(
        total="100.00",  # subtotal = 2 * 50
        declared_grand_total="100.00",
        tendered="100.00",
        items=[item],
    )
    atomic_commit(session, tenant_id=1, payload=payload)

    # Inspect every INSERT the atomic_commit made. The transaction_items
    # INSERT must carry line_total=100 (server-recomputed), never 9999.
    item_inserts = [
        call
        for call in session.execute.call_args_list
        if "INSERT INTO pos.transaction_items" in str(call.args[0])
    ]
    assert len(item_inserts) == 1
    params = item_inserts[0].args[1]
    assert params["lt"] == Decimal("100.0000")


def test_atomic_commit_tolerates_rounding_epsilon() -> None:
    """A 0.01 EGP rounding drift between client and server must pass."""
    from datapulse.pos.commit import atomic_commit

    session = _stub_session(returning_id=42)
    item = PosCartItem(
        drug_code="D",
        drug_name="Drug",
        quantity=Decimal("1"),
        unit_price=Decimal("10.00"),
        line_total=Decimal("10.00"),
    )
    # Client declared 10.01 — within epsilon of server's 10.00.
    payload = _payload(
        total="10.00",
        declared_grand_total="10.01",
        tendered="20.00",
        items=[item],
    )
    resp = atomic_commit(session, tenant_id=1, payload=payload)
    assert resp.transaction_id == 42
