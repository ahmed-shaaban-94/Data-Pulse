"""Outbound webhook delivery — subscriptions, HMAC-signed dispatch, retry, DLQ.

Public surface:
    fire_event(event_type, tenant_id, payload, session) — call from any service
    to enqueue and immediately attempt delivery to all active subscribers.
"""

from datapulse.webhooks.service import WebhookService

__all__ = ["WebhookService"]
