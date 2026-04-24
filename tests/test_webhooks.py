"""Unit tests for the outbound webhooks module (#608)."""

from __future__ import annotations

import datetime
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from datapulse.webhooks.dispatcher import (
    _RETRY_DELAYS,
    MAX_ATTEMPTS,
    compute_signature,
    next_retry_at,
)
from datapulse.webhooks.models import DeliveryLogResponse, SubscriptionCreate
from datapulse.webhooks.repository import WebhookRepository
from datapulse.webhooks.service import WebhookService

# ── dispatcher ────────────────────────────────────────────────────────────────


@pytest.mark.unit
class TestDispatcher:
    def test_compute_signature_is_deterministic(self):
        sig1 = compute_signature("secret", b"body")
        sig2 = compute_signature("secret", b"body")
        assert sig1 == sig2
        assert sig1.startswith("sha256=")

    def test_compute_signature_differs_on_body_change(self):
        assert compute_signature("s", b"a") != compute_signature("s", b"b")

    def test_compute_signature_differs_on_secret_change(self):
        assert compute_signature("s1", b"body") != compute_signature("s2", b"body")

    def test_next_retry_at_returns_datetime_for_valid_attempts(self):
        for i in range(len(_RETRY_DELAYS)):
            result = next_retry_at(i)
            assert result is not None
            assert result > datetime.datetime.now(datetime.UTC)

    def test_next_retry_at_returns_none_when_exhausted(self):
        assert next_retry_at(len(_RETRY_DELAYS)) is None

    def test_max_attempts_is_one_more_than_delays(self):
        assert len(_RETRY_DELAYS) + 1 == MAX_ATTEMPTS

    def test_retry_delays_are_increasing(self):
        for i in range(len(_RETRY_DELAYS) - 1):
            assert _RETRY_DELAYS[i] < _RETRY_DELAYS[i + 1]


# ── service ───────────────────────────────────────────────────────────────────


@pytest.mark.unit
class TestWebhookService:
    def _make_service(self):
        repo = MagicMock(spec=WebhookRepository)
        return WebhookService(repo), repo

    def test_create_subscription_delegates_to_repo(self):
        svc, repo = self._make_service()
        repo.create_subscription.return_value = {
            "id": 1,
            "event_type": "sale.created",
            "target_url": "https://example.com/hook",
            "is_active": True,
            "created_at": datetime.datetime.now(datetime.UTC),
        }
        result = svc.create_subscription(1, "sale.created", "https://example.com/hook", "secret123")
        repo.create_subscription.assert_called_once_with(
            1, "sale.created", "https://example.com/hook", "secret123"
        )
        assert result["event_type"] == "sale.created"

    def test_list_subscriptions_delegates_to_repo(self):
        svc, repo = self._make_service()
        repo.list_subscriptions.return_value = []
        result = svc.list_subscriptions(tenant_id=5)
        repo.list_subscriptions.assert_called_once_with(5)
        assert result == []

    def test_delete_subscription_returns_false_when_not_found(self):
        svc, repo = self._make_service()
        repo.delete_subscription.return_value = False
        assert svc.delete_subscription(99, 1) is False

    def test_fire_event_noop_when_no_subscribers(self):
        svc, repo = self._make_service()
        repo.get_active_subscribers.return_value = []
        svc.fire_event("sale.created", 1, {"order_id": "abc"})
        repo.create_delivery.assert_not_called()

    def test_fire_event_creates_delivery_per_subscriber(self):
        svc, repo = self._make_service()
        repo.get_active_subscribers.return_value = [
            {"id": 10, "target_url": "https://a.example.com", "secret": "s1"},
            {"id": 11, "target_url": "https://b.example.com", "secret": "s2"},
        ]
        repo.create_delivery.return_value = 42

        with patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            svc.fire_event("sale.created", 1, {"order_id": "abc"})

        assert repo.create_delivery.call_count == 2
        assert mock_thread.call_count == 2

    def test_retry_pending_dispatches_threads(self):
        svc, repo = self._make_service()
        repo.get_pending_retries.return_value = [
            {
                "id": 1,
                "target_url": "https://x.example.com",
                "secret": "sec",
                "event_type": "pipeline.completed",
                "payload": {"run_id": "abc"},
                "attempt_count": 1,
            }
        ]
        with patch("threading.Thread") as mock_thread:
            mock_thread.return_value.start = MagicMock()
            count = svc.retry_pending()

        assert count == 1
        mock_thread.assert_called_once()

    def test_replay_delivery_delegates_to_repo(self):
        svc, repo = self._make_service()
        repo.reset_for_replay.return_value = True
        assert svc.replay_delivery(7, 1) is True
        repo.reset_for_replay.assert_called_once_with(7, 1)


# ── models ────────────────────────────────────────────────────────────────────


@pytest.mark.unit
class TestWebhookModels:
    def test_subscription_create_rejects_non_http_url(self):
        with pytest.raises(ValidationError):
            SubscriptionCreate(
                event_type="sale.created",
                target_url="ftp://bad.com",  # type: ignore[arg-type]
                secret="s" * 16,
            )

    def test_subscription_create_rejects_short_secret(self):
        with pytest.raises(ValidationError):
            SubscriptionCreate(
                event_type="sale.created",
                target_url="https://ok.com",
                secret="short",
            )

    def test_subscription_create_valid(self):
        m = SubscriptionCreate(
            event_type="pipeline.completed",
            target_url="https://hooks.example.com/receive",
            secret="a" * 16,
        )
        assert m.event_type == "pipeline.completed"

    def test_delivery_log_response_from_dict(self):
        now = datetime.datetime.now(datetime.UTC)
        data = {
            "id": 1,
            "subscription_id": 2,
            "event_type": "sale.created",
            "payload": {"order_id": "abc"},
            "status": "sent",
            "attempt_count": 1,
            "next_retry_at": None,
            "last_error": None,
            "delivered_at": now,
            "created_at": now,
        }
        resp = DeliveryLogResponse(**data)
        assert resp.status == "sent"
        assert resp.delivered_at == now
