"""Pydantic models for the outbound webhooks API."""

from __future__ import annotations

import datetime
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field

# Supported event types — extend as new features emit events
WebhookEventType = Literal[
    "sale.created",
    "pipeline.completed",
    "pipeline.failed",
    "inventory.low",
    "upload.completed",
]

DeliveryStatus = Literal["pending", "sent", "failed", "dead"]


# ── Request / response models ─────────────────────────────────────────────────


class SubscriptionCreate(BaseModel):
    event_type: WebhookEventType
    target_url: AnyHttpUrl
    secret: str = Field(..., min_length=16, description="HMAC-SHA256 signing secret")


class SubscriptionResponse(BaseModel):
    id: int
    event_type: str
    target_url: str
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class DeliveryLogResponse(BaseModel):
    id: int
    subscription_id: int
    event_type: str
    payload: dict
    status: DeliveryStatus
    attempt_count: int
    next_retry_at: datetime.datetime | None
    last_error: str | None
    delivered_at: datetime.datetime | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
