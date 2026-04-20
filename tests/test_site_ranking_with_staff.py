"""Tests for site ranking enriched with staff_count (issue #507)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from datapulse.analytics.models import AnalyticsFilter, DateRange
from datapulse.analytics.ranking_repository import RankingRepository


@pytest.fixture()
def repo():
    session = MagicMock()
    return RankingRepository(session), session


def _filters() -> AnalyticsFilter:
    return AnalyticsFilter(
        date_range=DateRange(start_date=date(2026, 1, 1), end_date=date(2026, 3, 31))
    )


def test_site_ranking_with_staff_populates_count(repo):
    r, session = repo
    mock_result = MagicMock()
    # (site_key, site_name, value, staff_count)
    mock_result.fetchall.return_value = [
        (1, "Heliopolis", Decimal("1120000"), 4),
        (2, "Nasr City", Decimal("920000"), 3),
    ]
    session.execute.return_value = mock_result

    result = r.get_site_performance_with_staff(_filters())
    assert len(result.items) == 2
    assert result.items[0].name == "Heliopolis"
    assert result.items[0].staff_count == 4
    assert result.items[1].staff_count == 3


def test_site_ranking_with_staff_zero_when_no_staff(repo):
    r, session = repo
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        (3, "Ghost Branch", Decimal("120000"), 0),
    ]
    session.execute.return_value = mock_result

    result = r.get_site_performance_with_staff(_filters())
    assert result.items[0].staff_count == 0


def test_site_ranking_with_staff_empty_returns_empty_result(repo):
    r, session = repo
    mock_result = MagicMock()
    mock_result.fetchall.return_value = []
    session.execute.return_value = mock_result

    result = r.get_site_performance_with_staff(_filters())
    assert result.items == []
    assert result.total == Decimal("0")


def test_site_ranking_with_staff_computes_pct_of_total(repo):
    r, session = repo
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        (1, "A", Decimal("200"), 2),
        (2, "B", Decimal("300"), 3),
    ]
    session.execute.return_value = mock_result

    result = r.get_site_performance_with_staff(_filters())
    # A: 200 / 500 = 40.00%; B: 300 / 500 = 60.00%
    assert result.items[0].pct_of_total == Decimal("40.00")
    assert result.items[1].pct_of_total == Decimal("60.00")


def test_default_site_ranking_leaves_staff_count_none(repo):
    """Existing /analytics/sites (without include_staff) must still return
    items with staff_count=None so the model's default survives."""
    r, session = repo
    mock_result = MagicMock()
    mock_result.fetchall.return_value = [
        (1, "Heliopolis", Decimal("500000")),
    ]
    session.execute.return_value = mock_result

    result = r.get_site_performance(_filters())
    assert result.items[0].staff_count is None
