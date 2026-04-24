"""Outbound webhook subscription and delivery management routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from datapulse.core.auth import CurrentUser, SessionDep
from datapulse.webhooks.models import (
    DeliveryLogResponse,
    DeliveryStatus,
    SubscriptionCreate,
    SubscriptionResponse,
)
from datapulse.webhooks.repository import WebhookRepository
from datapulse.webhooks.service import WebhookService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _svc(session: SessionDep) -> WebhookService:
    return WebhookService(WebhookRepository(session))


WebhookServiceDep = Annotated[WebhookService, Depends(_svc)]


# ── Subscriptions ─────────────────────────────────────────────────────────────


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
def create_subscription(
    body: SubscriptionCreate,
    user: CurrentUser,
    svc: WebhookServiceDep,
) -> SubscriptionResponse:
    """Register a new webhook endpoint for a given event type."""
    tenant_id = int(user["tenant_id"])
    row = svc.create_subscription(
        tenant_id=tenant_id,
        event_type=body.event_type,
        target_url=str(body.target_url),
        secret=body.secret,
    )
    return SubscriptionResponse(**row)


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
def list_subscriptions(
    user: CurrentUser,
    svc: WebhookServiceDep,
) -> list[SubscriptionResponse]:
    """List all webhook subscriptions for the current tenant."""
    rows = svc.list_subscriptions(int(user["tenant_id"]))
    return [SubscriptionResponse(**r) for r in rows]


@router.delete("/subscriptions/{subscription_id}", status_code=204)
def delete_subscription(
    subscription_id: int,
    user: CurrentUser,
    svc: WebhookServiceDep,
) -> None:
    """Remove a webhook subscription."""
    deleted = svc.delete_subscription(subscription_id, int(user["tenant_id"]))
    if not deleted:
        raise HTTPException(status_code=404, detail="Subscription not found")


# ── Delivery log ──────────────────────────────────────────────────────────────


@router.get("/deliveries", response_model=list[DeliveryLogResponse])
def list_deliveries(
    user: CurrentUser,
    svc: WebhookServiceDep,
    subscription_id: int | None = None,
    status: DeliveryStatus | None = None,
    limit: int = 50,
) -> list[DeliveryLogResponse]:
    """Retrieve delivery log entries for debugging."""
    rows = svc.list_deliveries(
        tenant_id=int(user["tenant_id"]),
        subscription_id=subscription_id,
        status=status,
        limit=min(limit, 200),
    )
    return [DeliveryLogResponse(**r) for r in rows]


@router.post("/deliveries/{delivery_id}/replay", status_code=202)
def replay_delivery(
    delivery_id: int,
    user: CurrentUser,
    svc: WebhookServiceDep,
) -> dict:
    """Re-queue a failed or dead delivery for immediate retry."""
    replayed = svc.replay_delivery(delivery_id, int(user["tenant_id"]))
    if not replayed:
        raise HTTPException(
            status_code=404,
            detail="Delivery not found or not in a replayable state",
        )
    return {"queued": True, "delivery_id": delivery_id}
