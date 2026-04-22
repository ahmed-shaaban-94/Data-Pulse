# src/datapulse/billing/provider.py
"""Payment provider contract (#604 Spec 1).

Every billing integration (Stripe, Paymob, InstaPay) implements this Protocol.
``BillingService`` routes to the right provider based on tenant currency.

Sync (not async) to match existing StripeClient signatures — async buys
nothing since FastAPI handlers wrap these calls anyway.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from datapulse.billing.models import (
    CheckoutRequest,
    CheckoutResponse,
    PortalResponse,
    WebhookResult,
)


class ProviderUnavailableError(Exception):
    """Raised when no payment provider is configured for a given currency.

    Surfaces as HTTP 503 in the billing routes so users see
    ``Payments in <currency> are temporarily unavailable`` instead of a 500.
    """

    def __init__(self, currency: str) -> None:
        self.currency = currency
        super().__init__(
            f"No payment provider configured for {currency!r}. "
            "Contact support — Egyptian billing (EGP) is coming soon."
        )


@runtime_checkable
class PaymentProvider(Protocol):
    """Every payment integration satisfies this shape."""

    name: str
    currencies: frozenset[str]

    def create_checkout_session(self, req: CheckoutRequest) -> CheckoutResponse: ...
    def create_portal_session(self, tenant_id: int) -> PortalResponse: ...
    def handle_webhook_event(
        self, payload: bytes, signature: str, secret: str
    ) -> WebhookResult: ...
    def cancel_subscription(self, external_subscription_id: str) -> None: ...
