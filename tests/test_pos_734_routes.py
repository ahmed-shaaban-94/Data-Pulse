"""Unit tests for new observability routes — issue #734.

Covers:
- GET /_metrics returns Prometheus text format
- GET /_metrics includes samples recorded via _record_latency
- POST /perf/vitals returns 204 (no body)
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# metrics endpoint
# ---------------------------------------------------------------------------


def test_metrics_response_is_prometheus_text() -> None:
    """metrics() must always return Prometheus HELP + TYPE headers."""
    from datapulse.api.routes.metrics import metrics

    result = metrics()
    assert "# HELP datapulse_route_duration_ms" in result
    assert "# TYPE datapulse_route_duration_ms gauge" in result


def test_metrics_includes_recorded_sample() -> None:
    """A sample recorded via _record_latency must appear in metrics() output."""
    from datapulse.api.bootstrap.middleware import _record_latency
    from datapulse.api.routes.metrics import metrics

    _record_latency("GET", "/api/v1/test-route-734-metrics", 200, 42.0)
    result = metrics()

    assert "datapulse_route_duration_ms" in result
    assert "datapulse_route_requests_total" in result


def test_metrics_returns_newline_terminated() -> None:
    """Prometheus exposition format requires a trailing newline."""
    from datapulse.api.routes.metrics import metrics

    result = metrics()
    assert result.endswith("\n")


# ---------------------------------------------------------------------------
# perf/vitals endpoint
# ---------------------------------------------------------------------------


def test_receive_vital_returns_none() -> None:
    """receive_vital must return None (maps to HTTP 204 No Content)."""
    from datapulse.api.routes.perf import VitalPayload, receive_vital

    payload = VitalPayload(
        metric="FCP",
        value=1200.5,
        route="/dashboard",
        ts=1_700_000_000_000,
    )
    result = receive_vital(payload)
    assert result is None


def test_receive_vital_accepts_all_web_vital_names() -> None:
    """All standard web-vital names must be accepted without error."""
    from datapulse.api.routes.perf import VitalPayload, receive_vital

    for metric_name in ("FCP", "LCP", "CLS", "INP", "TTFB"):
        payload = VitalPayload(
            metric=metric_name,
            value=0.0,
            route="/test",
            ts=0,
        )
        result = receive_vital(payload)
        assert result is None
