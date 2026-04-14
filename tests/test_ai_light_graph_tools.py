"""Tests for AI-Light graph tool registry — each tool with a mocked AnalyticsRepository."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from datapulse.analytics.models import AnalyticsFilter, RankingResult, TrendResult

pytestmark = pytest.mark.unit

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_kpi(**overrides):
    """Return a minimal KPISummary-like MagicMock."""
    kpi = MagicMock()
    kpi.model_dump.return_value = {
        "today_gross": 150000.0,
        "mtd_gross": 3000000.0,
        "ytd_gross": 12000000.0,
        "mom_growth_pct": 5.2,
        "yoy_growth_pct": 11.0,
        "daily_transactions": 120,
        "daily_customers": 95,
        **overrides,
    }
    return kpi


def _make_trend_result():
    trend = MagicMock(spec=TrendResult)
    trend.model_dump.return_value = {
        "points": [{"period": "2026-04-01", "value": 100.0}],
        "total": 100.0,
        "average": 100.0,
        "minimum": 100.0,
        "maximum": 100.0,
        "growth_pct": None,
    }
    return trend


def _make_ranking_result():
    ranking = MagicMock(spec=RankingResult)
    ranking.model_dump.return_value = {
        "items": [{"rank": 1, "name": "Item A", "value": 50000.0, "pct_of_total": 33.3}],
        "total": 50000.0,
    }
    return ranking


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_repo():
    repo = MagicMock()
    repo.get_kpi_summary.return_value = _make_kpi()
    repo.get_daily_trend.return_value = _make_trend_result()
    repo.get_monthly_trend.return_value = _make_trend_result()
    repo.get_top_products.return_value = _make_ranking_result()
    repo.get_top_customers.return_value = _make_ranking_result()
    repo.get_top_staff.return_value = _make_ranking_result()
    repo.get_site_performance.return_value = _make_ranking_result()
    return repo


@pytest.fixture()
def tool_map(mock_repo):
    """Return the tool registry dict with AnalyticsRepository patched to mock_repo."""
    from datapulse.ai_light.graph.tools import build_tool_registry

    mock_session = MagicMock()
    mock_settings = MagicMock()
    with patch("datapulse.ai_light.graph.tools.AnalyticsRepository", return_value=mock_repo):
        return build_tool_registry(mock_session, mock_settings)


# ---------------------------------------------------------------------------
# Tests: tool registry shape
# ---------------------------------------------------------------------------


class TestBuildToolRegistry:
    def test_returns_dict(self, tool_map):
        assert isinstance(tool_map, dict)

    def test_core_tools_present(self, tool_map):
        expected = {
            "get_kpi_summary",
            "get_daily_trend",
            "get_monthly_trend",
            "get_top_products",
            "get_top_customers",
        }
        assert expected.issubset(set(tool_map.keys()))

    def test_all_values_callable(self, tool_map):
        for name, fn in tool_map.items():
            assert callable(fn), f"tool {name!r} is not callable"


# ---------------------------------------------------------------------------
# Tests: get_kpi_summary
# ---------------------------------------------------------------------------


class TestGetKpiSummary:
    def test_valid_date(self, tool_map, mock_repo):
        result = tool_map["get_kpi_summary"](target_date=date(2026, 4, 12))
        mock_repo.get_kpi_summary.assert_called_once_with(date(2026, 4, 12))
        assert isinstance(result, dict)
        assert "today_gross" in result

    def test_no_date_uses_today(self, tool_map, mock_repo):
        tool_map["get_kpi_summary"]()
        assert mock_repo.get_kpi_summary.called


# ---------------------------------------------------------------------------
# Tests: get_daily_trend
# ---------------------------------------------------------------------------


class TestGetDailyTrend:
    def test_calls_repo_with_filter(self, tool_map, mock_repo):
        result = tool_map["get_daily_trend"](
            start_date=date(2026, 3, 1), end_date=date(2026, 3, 31)
        )
        mock_repo.get_daily_trend.assert_called_once()
        call_arg = mock_repo.get_daily_trend.call_args[0][0]
        assert isinstance(call_arg, AnalyticsFilter)
        assert call_arg.date_range.start_date == date(2026, 3, 1)
        assert result["points"][0]["period"] == "2026-04-01"


# ---------------------------------------------------------------------------
# Tests: get_monthly_trend
# ---------------------------------------------------------------------------


class TestGetMonthlyTrend:
    def test_calls_repo(self, tool_map, mock_repo):
        result = tool_map["get_monthly_trend"](
            start_date=date(2026, 1, 1), end_date=date(2026, 3, 31)
        )
        mock_repo.get_monthly_trend.assert_called_once()
        assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# Tests: get_top_products
# ---------------------------------------------------------------------------


class TestGetTopProducts:
    def test_default_limit(self, tool_map, mock_repo):
        tool_map["get_top_products"](limit=5)
        call_arg = mock_repo.get_top_products.call_args[0][0]
        assert call_arg.limit == 5

    def test_with_date_range(self, tool_map, mock_repo):
        tool_map["get_top_products"](
            limit=5, start_date=date(2026, 1, 1), end_date=date(2026, 3, 31)
        )
        call_arg = mock_repo.get_top_products.call_args[0][0]
        assert call_arg.date_range is not None
        assert call_arg.date_range.start_date == date(2026, 1, 1)

    def test_without_date_range(self, tool_map, mock_repo):
        tool_map["get_top_products"](limit=5)
        call_arg = mock_repo.get_top_products.call_args[0][0]
        assert call_arg.date_range is None


# ---------------------------------------------------------------------------
# Tests: get_top_customers
# ---------------------------------------------------------------------------


class TestGetTopCustomers:
    def test_basic_call(self, tool_map, mock_repo):
        result = tool_map["get_top_customers"](limit=5)
        mock_repo.get_top_customers.assert_called_once()
        assert isinstance(result, dict)

    def test_with_date_range(self, tool_map, mock_repo):
        tool_map["get_top_customers"](
            limit=3, start_date=date(2026, 1, 1), end_date=date(2026, 3, 31)
        )
        call_arg = mock_repo.get_top_customers.call_args[0][0]
        assert call_arg.date_range is not None
