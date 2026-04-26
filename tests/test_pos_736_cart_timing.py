"""Unit tests for _service_cart.py timing instrumentation (issue #736).

Verifies that add_item, update_item, and remove_item emit structured log
events with the expected keys after each successful operation.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from datapulse.pos.inventory_contract import (
    BatchInfo,
    InventoryServiceProtocol,
    StockLevel,
)
from datapulse.pos.service import PosService

pytestmark = pytest.mark.unit


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def mock_inventory() -> AsyncMock:
    inv = AsyncMock(spec=InventoryServiceProtocol)
    inv.get_stock_level = AsyncMock(
        return_value=StockLevel(
            drug_code="DRUG-T1",
            site_code="SITE01",
            quantity_on_hand=Decimal("100"),
            quantity_reserved=Decimal("0"),
            quantity_available=Decimal("100"),
            reorder_point=Decimal("10"),
        )
    )
    inv.check_batch_expiry = AsyncMock(
        return_value=[
            BatchInfo(
                batch_number="BATCH-001",
                expiry_date=date(2027, 6, 30),
                quantity_available=Decimal("100"),
            )
        ]
    )
    return inv


@pytest.fixture()
def service(mock_repo: MagicMock, mock_inventory: AsyncMock) -> PosService:
    return PosService(mock_repo, mock_inventory)


def _make_product() -> dict:
    return {
        "drug_code": "DRUG-T1",
        "drug_name": "Test Drug",
        "drug_category": "OTC",
        "unit_price": Decimal("25.00"),
        "cost_price": Decimal("15.00"),
    }


def _make_item_row() -> dict:
    return {
        "id": 1,
        "transaction_id": 10,
        "tenant_id": 1,
        "drug_code": "DRUG-T1",
        "drug_name": "Test Drug",
        "batch_number": "BATCH-001",
        "expiry_date": date(2027, 6, 30),
        "quantity": Decimal("2"),
        "unit_price": Decimal("25.00"),
        "discount": Decimal("0"),
        "line_total": Decimal("50.00"),
        "is_controlled": False,
        "pharmacist_id": None,
        "cost_per_unit": Decimal("15.00"),
    }


def _make_txn_row(status: str = "draft") -> dict:
    return {
        "id": 10,
        "tenant_id": 1,
        "terminal_id": 1,
        "staff_id": "staff-1",
        "pharmacist_id": None,
        "customer_id": None,
        "site_code": "SITE01",
        "subtotal": Decimal("0"),
        "discount_total": Decimal("0"),
        "tax_total": Decimal("0"),
        "grand_total": Decimal("0"),
        "payment_method": None,
        "status": status,
        "receipt_number": None,
        "created_at": "2026-04-26T10:00:00",
    }


# ---------------------------------------------------------------------------
# add_item — timing log
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_item_logs_timing_keys(
    service: PosService,
    mock_repo: MagicMock,
    mock_inventory: AsyncMock,
) -> None:
    """add_item must emit cart_add_item_timing with all required keys."""
    mock_repo.get_product_by_code.return_value = _make_product()
    mock_repo.add_transaction_item.return_value = _make_item_row()

    captured: list[dict] = []

    def fake_info(event: str, **kwargs: object) -> None:
        captured.append({"event": event, **kwargs})

    with patch("datapulse.pos._service_cart.log") as mock_log:
        mock_log.info.side_effect = fake_info
        mock_log.warning.side_effect = lambda *a, **kw: None  # silence warnings

        await service.add_item(
            transaction_id=10,
            tenant_id=1,
            site_code="SITE01",
            drug_code="DRUG-T1",
            quantity=Decimal("2"),
        )

    timing_events = [e for e in captured if e["event"] == "cart_add_item_timing"]
    assert len(timing_events) == 1, "Exactly one cart_add_item_timing event expected"

    ev = timing_events[0]
    for key in ("stock_check_ms", "batch_select_ms", "db_write_ms", "total_ms"):
        assert key in ev, f"Missing key {key!r} in timing log"
        assert isinstance(ev[key], float), f"{key} must be a float (got {type(ev[key])})"
        assert ev[key] >= 0, f"{key} must be non-negative"

    assert ev["tenant_id"] == 1
    assert ev["drug_code"] == "DRUG-T1"


# ---------------------------------------------------------------------------
# update_item — timing log
# ---------------------------------------------------------------------------


def test_update_item_logs_timing_keys(
    service: PosService,
    mock_repo: MagicMock,
) -> None:
    """update_item must emit cart_update_item_timing with db_write_ms."""
    item_row = _make_item_row()
    mock_repo.get_transaction_item.return_value = item_row
    mock_repo.get_transaction.return_value = _make_txn_row()
    mock_repo.update_item_quantity.return_value = {
        **item_row,
        "quantity": Decimal("3"),
        "line_total": Decimal("75.00"),
    }

    captured: list[dict] = []

    def fake_info(event: str, **kwargs: object) -> None:
        captured.append({"event": event, **kwargs})

    with patch("datapulse.pos._service_cart.log") as mock_log:
        mock_log.info.side_effect = fake_info
        mock_log.warning.side_effect = lambda *a, **kw: None

        service.update_item(
            1,
            tenant_id=1,
            quantity=Decimal("3"),
        )

    timing_events = [e for e in captured if e["event"] == "cart_update_item_timing"]
    assert len(timing_events) == 1, "Exactly one cart_update_item_timing event expected"

    ev = timing_events[0]
    assert "db_write_ms" in ev
    assert isinstance(ev["db_write_ms"], float)
    assert ev["db_write_ms"] >= 0
    assert ev["tenant_id"] == 1
    assert ev["item_id"] == 1


# ---------------------------------------------------------------------------
# remove_item — timing log
# ---------------------------------------------------------------------------


def test_remove_item_logs_timing_keys(
    service: PosService,
    mock_repo: MagicMock,
) -> None:
    """remove_item must emit cart_remove_item_timing with db_write_ms."""
    item_row = _make_item_row()
    mock_repo.get_transaction_item.return_value = item_row
    mock_repo.get_transaction.return_value = _make_txn_row()
    mock_repo.remove_item.return_value = True

    captured: list[dict] = []

    def fake_info(event: str, **kwargs: object) -> None:
        captured.append({"event": event, **kwargs})

    with patch("datapulse.pos._service_cart.log") as mock_log:
        mock_log.info.side_effect = fake_info
        mock_log.warning.side_effect = lambda *a, **kw: None

        result = service.remove_item(1, tenant_id=1)

    assert result is True

    timing_events = [e for e in captured if e["event"] == "cart_remove_item_timing"]
    assert len(timing_events) == 1, "Exactly one cart_remove_item_timing event expected"

    ev = timing_events[0]
    assert "db_write_ms" in ev
    assert isinstance(ev["db_write_ms"], float)
    assert ev["db_write_ms"] >= 0
    assert ev["tenant_id"] == 1
    assert ev["item_id"] == 1


# ---------------------------------------------------------------------------
# slow-op warning threshold
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_item_emits_slow_op_warning_when_over_threshold(
    service: PosService,
    mock_repo: MagicMock,
    mock_inventory: AsyncMock,
) -> None:
    """When total_ms > 500 add_item must also emit a cart_slow_op warning."""
    mock_repo.get_product_by_code.return_value = _make_product()
    mock_repo.add_transaction_item.return_value = _make_item_row()

    warnings_captured: list[dict] = []

    def fake_warning(event: str, **kwargs: object) -> None:
        warnings_captured.append({"event": event, **kwargs})

    # Patch perf_counter so first call returns 0 and subsequent calls
    # simulate 600 ms total elapsed (well above the 500 ms threshold).
    # Use a monotonically-increasing sequence with enough values to cover
    # all perf_counter calls in add_item (t0, after stock_check, t1,
    # after batch_select, t2, after db_write, total).
    call_count = 0
    base_values = [0.0, 0.001, 0.002, 0.003, 0.004, 0.005, 0.600]

    def mono_counter() -> float:
        nonlocal call_count
        val = base_values[min(call_count, len(base_values) - 1)]
        call_count += 1
        return val

    with patch("datapulse.pos._service_cart.log") as mock_log:
        mock_log.info.return_value = None
        mock_log.warning.side_effect = fake_warning
        with patch("datapulse.pos._service_cart.time") as mock_time:
            mock_time.perf_counter.side_effect = mono_counter

            await service.add_item(
                transaction_id=10,
                tenant_id=1,
                site_code="SITE01",
                drug_code="DRUG-T1",
                quantity=Decimal("2"),
            )

    slow_warnings = [e for e in warnings_captured if e["event"] == "cart_slow_op"]
    assert len(slow_warnings) == 1, "Expected one cart_slow_op warning"
    assert slow_warnings[0]["operation"] == "add_item"
