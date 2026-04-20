"""Tests for reorder-alert enrichment (issue #507).

Covers the pure status-threshold logic and repository-level derivation —
days-of-stock + status from raw (current_quantity, daily_velocity) rows.
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from datapulse.inventory.models import InventoryFilter
from datapulse.inventory.repository import InventoryRepository

# ------------------------------------------------------------------
# _derive_reorder_status — pure threshold logic
# ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("days", "expected"),
    [
        (Decimal("0"), "critical"),  # < 5
        (Decimal("2.5"), "critical"),  # < 5
        (Decimal("4.9"), "critical"),  # < 5
        (Decimal("5"), "low"),  # boundary — not critical
        (Decimal("7.5"), "low"),  # < 10
        (Decimal("9.9"), "low"),  # < 10
        (Decimal("10"), "healthy"),  # boundary — not low
        (Decimal("25"), "healthy"),
    ],
)
def test_derive_status_thresholds(days: Decimal, expected: str) -> None:
    assert InventoryRepository._derive_reorder_status(days) == expected


def test_derive_status_none_is_low() -> None:
    """Zero velocity (no sales in window) -> low, not critical."""
    assert InventoryRepository._derive_reorder_status(None) == "low"


# ------------------------------------------------------------------
# get_reorder_alerts — end-to-end enrichment via mocked session
# ------------------------------------------------------------------


@pytest.fixture()
def mock_session() -> MagicMock:
    session = MagicMock()
    session.execute.return_value.mappings.return_value.all.return_value = []
    return session


@pytest.fixture()
def repo(mock_session: MagicMock) -> InventoryRepository:
    return InventoryRepository(mock_session)


def _row(**overrides) -> dict:
    base = {
        "product_key": 1,
        "site_key": 1,
        "drug_code": "D001",
        "drug_name": "Paracetamol",
        "site_code": "S01",
        "current_quantity": Decimal("50"),
        "reorder_point": Decimal("100"),
        "reorder_quantity": Decimal("200"),
        "daily_velocity": Decimal("10"),
    }
    base.update(overrides)
    return base


def test_reorder_alerts_computes_days_of_stock(
    repo: InventoryRepository, mock_session: MagicMock
) -> None:
    # 50 units / 10 per day = 5.0 days -> low (>= 5 boundary)
    mock_session.execute.return_value.mappings.return_value.all.return_value = [_row()]
    alerts = repo.get_reorder_alerts(InventoryFilter())
    assert len(alerts) == 1
    assert alerts[0].days_of_stock == Decimal("5.0")
    assert alerts[0].status == "low"
    assert alerts[0].daily_velocity == Decimal("10")


def test_reorder_alerts_critical_when_below_five_days(
    repo: InventoryRepository, mock_session: MagicMock
) -> None:
    # 20 units / 10 per day = 2.0 days -> critical
    mock_session.execute.return_value.mappings.return_value.all.return_value = [
        _row(current_quantity=Decimal("20"), daily_velocity=Decimal("10")),
    ]
    alerts = repo.get_reorder_alerts(InventoryFilter())
    assert alerts[0].status == "critical"


def test_reorder_alerts_healthy_when_ten_plus_days(
    repo: InventoryRepository, mock_session: MagicMock
) -> None:
    mock_session.execute.return_value.mappings.return_value.all.return_value = [
        _row(current_quantity=Decimal("100"), daily_velocity=Decimal("5")),
    ]
    alerts = repo.get_reorder_alerts(InventoryFilter())
    assert alerts[0].status == "healthy"
    assert alerts[0].days_of_stock == Decimal("20.0")


def test_reorder_alerts_zero_velocity_yields_none_days(
    repo: InventoryRepository, mock_session: MagicMock
) -> None:
    """No sales in trailing window -> days_of_stock=None, status=low."""
    mock_session.execute.return_value.mappings.return_value.all.return_value = [
        _row(daily_velocity=Decimal("0")),
    ]
    alerts = repo.get_reorder_alerts(InventoryFilter())
    assert alerts[0].days_of_stock is None
    assert alerts[0].status == "low"
    assert alerts[0].daily_velocity == Decimal("0")


def test_reorder_alerts_passes_velocity_window_param(
    repo: InventoryRepository, mock_session: MagicMock
) -> None:
    repo.get_reorder_alerts(InventoryFilter())
    params = mock_session.execute.call_args[0][1]
    assert params["velocity_days"] == 30


def test_reorder_alerts_empty_list(repo: InventoryRepository, mock_session: MagicMock) -> None:
    assert repo.get_reorder_alerts(InventoryFilter()) == []
