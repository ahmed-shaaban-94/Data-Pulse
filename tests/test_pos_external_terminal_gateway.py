"""Unit tests for ExternalCardTerminalGateway.

The pharmacy uses a physical card terminal (e.g. Paymob EFT-POS, or a
bank-acquired terminal). The card never touches our software. The cashier
runs the card on the physical terminal, and once it prints "approved"
they enter the approval code into POS. Our software just records the
fact of payment; we don't authorise, capture, or 3DS — the terminal does.

This collapses the prior in-software Paymob flow (audit findings C1, H1,
H2, H3, M6 from the 2026-04-26 POS audit) into a record-and-receipt
operation. PCI scope drops to SAQ-B. The Paymob client remains in
``src/datapulse/billing/`` for SaaS subscription billing and a future
e-commerce module.

What this gateway must enforce:
    * approval_code is mandatory and non-empty (cashier cannot skip it).
    * approval_code is recorded on PaymentResult.authorization_code so
      the receipt and bronze write carry it through unchanged.
    * terminal_id and card_last4 are optional audit hints.
    * card_last4 — when supplied — must be exactly 4 digits.
    * Money math is unchanged from CashGateway: Decimal, no float.
    * The gateway never raises for expected failure (missing approval
      code) — it returns ``PaymentResult(success=False)`` in line with
      the PaymentGateway contract.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from datapulse.pos.external_terminal_gateway import ExternalCardTerminalGateway
from datapulse.pos.payment import PaymentResult

pytestmark = pytest.mark.unit


class TestExternalCardTerminalGateway:
    def test_records_approval_code_as_authorization(self):
        """Happy path — approval code propagates to PaymentResult.authorization_code."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("135.50"),
            card_approval_code="123456",
        )
        assert result.success is True
        assert result.method == "card"
        assert result.amount_charged == Decimal("135.50")
        assert result.authorization_code == "123456"
        assert result.change_due == Decimal("0")

    def test_missing_approval_code_fails_closed(self):
        """No approval code → no payment recorded. Cashier must enter it."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(Decimal("50"))
        assert result.success is False
        assert result.amount_charged == Decimal("0")
        assert "approval" in result.message.lower()

    def test_empty_approval_code_fails_closed(self):
        """Empty/whitespace approval code is not a valid record of payment."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("50"),
            card_approval_code="   ",
        )
        assert result.success is False
        assert "approval" in result.message.lower()

    def test_amount_preserves_precision(self):
        """No truncation, no rounding drift on the charged amount."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("99.9999"),
            card_approval_code="A1B2C3",
        )
        assert result.success is True
        assert result.amount_charged == Decimal("99.9999")

    def test_card_last4_optional(self):
        """last4 is an audit hint; absent is allowed."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("10"),
            card_approval_code="999000",
        )
        assert result.success is True

    def test_card_last4_must_be_four_digits_when_supplied(self):
        """If the cashier types last4, it must look like last4."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("10"),
            card_approval_code="999000",
            card_last4="12",
        )
        assert result.success is False
        assert "last4" in result.message.lower()

    def test_card_last4_rejects_non_digits(self):
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("10"),
            card_approval_code="999000",
            card_last4="12ab",
        )
        assert result.success is False
        assert "last4" in result.message.lower()

    def test_card_last4_rejects_empty_string(self):
        """Defensive: an empty string is not None but is also not 4 digits.

        Without this assertion, a client sending ``card_last4=""`` would
        slip past the ``is not None`` guard and rely on the ``len() == 4``
        check — which is correct today but easy to regress.
        """
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("10"),
            card_approval_code="999000",
            card_last4="",
        )
        assert result.success is False
        assert "last4" in result.message.lower()

    def test_terminal_id_passes_through(self):
        """terminal_id is recorded for end-of-day reconciliation reports."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("10"),
            card_approval_code="999000",
            card_terminal_id="TERM-01",
        )
        assert result.success is True
        # terminal_id is not on PaymentResult itself — it's already on the
        # CheckoutRequest and lands in bronze via the service layer. The
        # gateway just shouldn't error when it's supplied.

    def test_returns_payment_result_type(self):
        """Contract: always a PaymentResult, never raises for payment-level errors."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("50"),
            card_approval_code="ABC123",
        )
        assert isinstance(result, PaymentResult)

    def test_does_not_use_tendered_or_insurance_kwargs(self):
        """Extra kwargs from PaymentGateway contract are silently ignored."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(
            Decimal("50"),
            tendered=Decimal("100"),
            insurance_no="INS-1",
            card_approval_code="OK999",
        )
        assert result.success is True
        # Card terminal doesn't return change — that's a cash-only concept.
        assert result.change_due == Decimal("0")

    def test_zero_amount_still_requires_approval_code(self):
        """Defensive: even a zero-charge requires an explicit approval."""
        gw = ExternalCardTerminalGateway()
        result = gw.process_payment(Decimal("0"))
        assert result.success is False


class TestGetGatewayWiresExternalTerminal:
    """get_gateway('card') must return ExternalCardTerminalGateway, not the old stub."""

    def test_card_method_returns_external_terminal_gateway(self):
        from datapulse.pos.payment import get_gateway

        gw = get_gateway("card")
        assert isinstance(gw, ExternalCardTerminalGateway)


class TestCheckoutRequestCarriesTerminalFields:
    """CheckoutRequest must carry approval_code/terminal_id/last4 for card method."""

    def test_card_method_without_approval_code_rejected(self):
        """Validator rejects card payment lacking approval code at the request boundary.

        This is the model-level guard. The gateway also enforces it at the
        gateway layer (defense in depth) — but a pydantic validator gives a
        clearer 422 to the API client than a 400 from the gateway.
        """
        from pydantic import ValidationError

        from datapulse.pos.constants import PaymentMethod
        from datapulse.pos.models import CheckoutRequest

        with pytest.raises(ValidationError, match="card_approval_code"):
            CheckoutRequest(payment_method=PaymentMethod.card)

    def test_card_method_with_approval_code_accepted(self):
        from datapulse.pos.constants import PaymentMethod
        from datapulse.pos.models import CheckoutRequest

        req = CheckoutRequest(
            payment_method=PaymentMethod.card,
            card_approval_code="123456",
            card_terminal_id="TERM-01",
            card_last4="1234",
        )
        assert req.card_approval_code == "123456"
        assert req.card_terminal_id == "TERM-01"
        assert req.card_last4 == "1234"

    def test_cash_method_does_not_require_approval_code(self):
        from datapulse.pos.constants import PaymentMethod
        from datapulse.pos.models import CheckoutRequest

        req = CheckoutRequest(payment_method=PaymentMethod.cash)
        assert req.card_approval_code is None

    def test_card_last4_validates_four_digits_at_model_level(self):
        from pydantic import ValidationError

        from datapulse.pos.constants import PaymentMethod
        from datapulse.pos.models import CheckoutRequest

        with pytest.raises(ValidationError, match="card_last4"):
            CheckoutRequest(
                payment_method=PaymentMethod.card,
                card_approval_code="123456",
                card_last4="12",
            )
