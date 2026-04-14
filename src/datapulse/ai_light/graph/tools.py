"""Tool registry for the AI Light graph.

Tools are plain Python callables — no @tool decorator required — so they
can be unit-tested without installing langchain_core. Each tool takes
explicit arguments and returns a JSON-serialisable dict.

``build_tool_registry(session, settings)`` returns a dict of
``{tool_name: callable}`` captured over the per-request RLS session.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from datapulse.config import Settings


def build_tool_registry(
    session: Session,
    settings: Settings,  # noqa: ARG001 — reserved for future use (cost caps, etc.)
) -> dict[str, Callable[..., dict[str, Any]]]:
    """Return a dict mapping tool name → callable bound to *session*.

    Each callable accepts keyword arguments and returns a JSON-serialisable
    dict ready for insertion into AILightState.
    """
    from datapulse.analytics.models import AnalyticsFilter, DateRange
    from datapulse.analytics.repository import AnalyticsRepository

    repo = AnalyticsRepository(session)

    # ── Tool 1: get_kpi_summary ───────────────────────────────────────────
    def get_kpi_summary(target_date: date | None = None) -> dict[str, Any]:
        kpi = repo.get_kpi_summary(target_date or date.today())
        return kpi.model_dump(mode="json")

    # ── Tool 2: get_daily_trend ───────────────────────────────────────────
    def get_daily_trend(
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        end = end_date or date.today()
        start = start_date or (end - timedelta(days=30))
        filters = AnalyticsFilter(date_range=DateRange(start_date=start, end_date=end))
        result = repo.get_daily_trend(filters)
        return result.model_dump(mode="json")

    # ── Tool 3: get_monthly_trend ─────────────────────────────────────────
    def get_monthly_trend(
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        end = end_date or date.today()
        start = start_date or (end - timedelta(days=365))
        filters = AnalyticsFilter(date_range=DateRange(start_date=start, end_date=end))
        result = repo.get_monthly_trend(filters)
        return result.model_dump(mode="json")

    # ── Tool 4: get_top_products ──────────────────────────────────────────
    def get_top_products(
        limit: int = 5,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        dr = None
        if start_date and end_date:
            dr = DateRange(start_date=start_date, end_date=end_date)
        filters = AnalyticsFilter(date_range=dr, limit=limit)
        result = repo.get_top_products(filters)
        return result.model_dump(mode="json")

    # ── Tool 5: get_top_customers ─────────────────────────────────────────
    def get_top_customers(
        limit: int = 5,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        dr = None
        if start_date and end_date:
            dr = DateRange(start_date=start_date, end_date=end_date)
        filters = AnalyticsFilter(date_range=dr, limit=limit)
        result = repo.get_top_customers(filters)
        return result.model_dump(mode="json")

    # ── Tool 6: get_top_staff ─────────────────────────────────────────────
    def get_top_staff(
        limit: int = 5,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        dr = None
        if start_date and end_date:
            dr = DateRange(start_date=start_date, end_date=end_date)
        filters = AnalyticsFilter(date_range=dr, limit=limit)
        result = repo.get_top_staff(filters)
        return result.model_dump(mode="json")

    # ── Tool 7: get_site_performance ──────────────────────────────────────
    def get_site_performance(
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict[str, Any]:
        dr = None
        if start_date and end_date:
            dr = DateRange(start_date=start_date, end_date=end_date)
        filters = AnalyticsFilter(date_range=dr)
        result = repo.get_site_performance(filters)
        return result.model_dump(mode="json")

    # ── Tool 8: get_top_gainers ───────────────────────────────────────────
    def get_top_gainers(
        current_start: date,
        current_end: date,
        previous_start: date,
        previous_end: date,
        limit: int = 5,
    ) -> dict[str, Any]:
        from datapulse.analytics.comparison_repository import ComparisonRepository

        comp_repo = ComparisonRepository(session)
        current_filters = AnalyticsFilter(
            date_range=DateRange(start_date=current_start, end_date=current_end),
            limit=limit,
        )
        previous_filters = AnalyticsFilter(
            date_range=DateRange(start_date=previous_start, end_date=previous_end),
            limit=limit,
        )
        result = comp_repo.get_top_movers("product", current_filters, previous_filters, limit)
        gainers = [m.model_dump(mode="json") for m in result.gainers]
        return {"gainers": gainers, "entity_type": "product"}

    # ── Tool 9: get_top_losers ────────────────────────────────────────────
    def get_top_losers(
        current_start: date,
        current_end: date,
        previous_start: date,
        previous_end: date,
        limit: int = 5,
    ) -> dict[str, Any]:
        from datapulse.analytics.comparison_repository import ComparisonRepository

        comp_repo = ComparisonRepository(session)
        current_filters = AnalyticsFilter(
            date_range=DateRange(start_date=current_start, end_date=current_end),
            limit=limit,
        )
        previous_filters = AnalyticsFilter(
            date_range=DateRange(start_date=previous_start, end_date=previous_end),
            limit=limit,
        )
        result = comp_repo.get_top_movers("product", current_filters, previous_filters, limit)
        losers = [m.model_dump(mode="json") for m in result.losers]
        return {"losers": losers, "entity_type": "product"}

    # ── Tool 10: get_active_anomaly_alerts ────────────────────────────────
    def get_active_anomaly_alerts(limit: int = 10) -> dict[str, Any]:
        from datapulse.anomalies.repository import AnomalyRepository

        anomaly_repo = AnomalyRepository(session)
        alerts = anomaly_repo.get_active_alerts(limit=limit)
        return {"alerts": [a.model_dump(mode="json") for a in alerts]}

    return {
        "get_kpi_summary": get_kpi_summary,
        "get_daily_trend": get_daily_trend,
        "get_monthly_trend": get_monthly_trend,
        "get_top_products": get_top_products,
        "get_top_customers": get_top_customers,
        "get_top_staff": get_top_staff,
        "get_site_performance": get_site_performance,
        "get_top_gainers": get_top_gainers,
        "get_top_losers": get_top_losers,
        "get_active_anomaly_alerts": get_active_anomaly_alerts,
    }
