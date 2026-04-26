"""Card payments via an external physical terminal (Paymob EFT-POS, bank
acquirer, etc.).

The card never enters our software. The cashier runs it on the terminal,
and once the slip prints "approved" they enter the approval code into the
POS. This gateway records that fact — it does no auth, capture, or 3DS;
those happen in the hardware/acquirer outside our process.

This replaces the prior in-software ``PaymobCardGateway`` (audit findings
C1, H1, H2, H3, M6 from 2026-04-26 — POS surface). The Paymob client
remains in :mod:`datapulse.billing` for SaaS subscription billing.

Contract: same :class:`PaymentGateway` ABC as :class:`CashGateway`. Never
raises for expected failures (missing approval code) — returns
``PaymentResult(success=False)``.
"""

from __future__ import annotations

from decimal import Decimal

from datapulse.pos.payment import PaymentGateway, PaymentResult


class ExternalCardTerminalGateway(PaymentGateway):
    """Records a card payment that has already been approved on a physical
    terminal. Requires an approval code; treats ``card_last4`` as an audit
    hint (must look like 4 digits if supplied).
    """

    def process_payment(
        self,
        amount: Decimal,
        *,
        tendered: Decimal | None = None,
        insurance_no: str | None = None,
        card_token: str | None = None,
        card_approval_code: str | None = None,
        card_terminal_id: str | None = None,
        card_last4: str | None = None,
        **kwargs,
    ) -> PaymentResult:
        approval = (card_approval_code or "").strip()
        if not approval:
            return PaymentResult(
                success=False,
                method="card",
                amount_charged=Decimal("0"),
                message=(
                    "Card payment requires an approval code from the physical "
                    "terminal. Run the card on the terminal first, then enter "
                    "the printed approval code."
                ),
            )

        if card_last4 is not None and not (len(card_last4) == 4 and card_last4.isdigit()):
            return PaymentResult(
                success=False,
                method="card",
                amount_charged=Decimal("0"),
                message="card_last4 must be exactly 4 digits when supplied.",
            )

        return PaymentResult(
            success=True,
            method="card",
            amount_charged=amount,
            authorization_code=approval,
            message="Card payment recorded from external terminal.",
        )
