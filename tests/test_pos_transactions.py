"""HTTP-level tests for cart-mutation endpoints with idempotency (issue #733).

Covers:
- add_item / update_item / remove_item accept and honour Idempotency-Key
- Same key replays cached response without calling the service again
- Different key proceeds normally
- Concurrent requests with the same key: one wins, others get 409
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from datapulse.api.auth import get_current_user
from datapulse.api.deps import (
    get_pos_service,
    get_tenant_plan_limits,
    get_tenant_session,
)
from datapulse.billing.plans import PLAN_LIMITS
from datapulse.pos.constants import TransactionStatus
from datapulse.pos.exceptions import InsufficientStockError
from datapulse.pos.idempotency import IdempotencyContext
from datapulse.pos.models import (
    CheckoutRequest,
    CheckoutResponse,
    CommitRequest,
    CommitResponse,
    PosCartItem,
    TransactionDetailResponse,
    UpdateItemRequest,
)
from datapulse.rbac.dependencies import get_access_context
from datapulse.rbac.models import AccessContext

pytestmark = pytest.mark.unit

MOCK_USER = {
    "sub": "test-user",
    "email": "test@datapulse.local",
    "tenant_id": "1",
    "roles": ["admin"],
    "raw_claims": {},
}


def _make_app(service: MagicMock, mock_session: MagicMock | None = None) -> FastAPI:
    from datapulse.api.routes.pos import router as pos_router

    app = FastAPI()
    app.include_router(pos_router, prefix="/api/v1")
    _ctx = AccessContext(
        member_id=1,
        tenant_id=1,
        user_id="test-user",
        role_key="admin",
        permissions={
            "pos:terminal:open",
            "pos:transaction:create",
            "pos:transaction:checkout",
            "pos:transaction:void",
            "pos:return:create",
            "pos:shift:reconcile",
            "pos:shift:open",
            "pos:controlled:verify",
        },
    )
    app.dependency_overrides[get_current_user] = lambda: MOCK_USER
    app.dependency_overrides[get_pos_service] = lambda: service
    app.dependency_overrides[get_tenant_plan_limits] = lambda: PLAN_LIMITS["platform"]
    app.dependency_overrides[get_access_context] = lambda: _ctx

    _sess = mock_session or MagicMock()
    _sess.execute.return_value.mappings.return_value.first.return_value = None
    app.dependency_overrides[get_tenant_session] = lambda: _sess

    @app.exception_handler(InsufficientStockError)
    async def _h1(_req: Request, exc: InsufficientStockError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": exc.message})

    return app


@pytest.fixture()
def mock_service() -> MagicMock:
    svc = MagicMock()
    svc.add_item = AsyncMock()
    svc.checkout = AsyncMock()
    svc.get_stock_info = AsyncMock()
    return svc


@pytest.fixture()
def client(mock_service: MagicMock) -> TestClient:
    return TestClient(_make_app(mock_service))


def _txn_detail() -> TransactionDetailResponse:
    return TransactionDetailResponse(
        id=100,
        terminal_id=1,
        staff_id="staff-1",
        site_code="SITE01",
        subtotal=Decimal("0"),
        discount_total=Decimal("0"),
        tax_total=Decimal("0"),
        grand_total=Decimal("0"),
        status=TransactionStatus.draft,
        created_at=datetime(2026, 4, 15, 10, 30, tzinfo=UTC),
        items=[],
    )


def _cart_item() -> PosCartItem:
    return PosCartItem(
        drug_code="DRUG001",
        drug_name="Paracetamol",
        batch_number="BATCH-1",
        expiry_date=None,
        quantity=Decimal("3"),
        unit_price=Decimal("12.5"),
        discount=Decimal("0"),
        line_total=Decimal("37.5"),
        is_controlled=False,
        pharmacist_id=None,
    )


# ---------------------------------------------------------------------------
# add_item — requires Idempotency-Key
# ---------------------------------------------------------------------------


class TestAddItemIdempotency:
    def test_add_item_requires_idempotency_key(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        """add_item must reject requests without Idempotency-Key (422)."""
        mock_service.get_transaction_detail.return_value = _txn_detail()
        resp = client.post(
            "/api/v1/pos/transactions/100/items",
            json={"drug_code": "DRUG001", "quantity": "3"},
            # No Idempotency-Key header
        )
        assert resp.status_code == 422
        mock_service.add_item.assert_not_called()

    def test_add_item_fresh_key_calls_service(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        """First request with a new key executes normally."""
        mock_service.get_transaction_detail.return_value = _txn_detail()
        mock_service.add_item.return_value = _cart_item()
        resp = client.post(
            "/api/v1/pos/transactions/100/items",
            json={"drug_code": "DRUG001", "quantity": "3"},
            headers={"Idempotency-Key": "fresh-key-add-001"},
        )
        assert resp.status_code == 201
        mock_service.add_item.assert_called_once()

    def test_add_item_replay_returns_cached_no_mutation(self, mock_service: MagicMock) -> None:
        """Replay with the same key returns cached body without calling service."""
        cached_item = _cart_item()
        cached_body: dict[str, Any] = cached_item.model_dump(mode="json")

        mock_session = MagicMock()
        # Simulate an existing idempotency row with a cached response
        mock_session.execute.return_value.mappings.return_value.first.return_value = {
            "request_hash": "a" * 64,
            "response_status": 200,
            "response_body": cached_body,
            "expires_at": datetime(2099, 1, 1, tzinfo=UTC),
        }

        # Patch the idempotency dep to return a replay context
        from datapulse.api.routes import _pos_transactions as pos_module

        original_dep = pos_module._add_item_idempotency_dep

        async def _replay_dep(
            request: Request,  # noqa: ARG001
        ) -> IdempotencyContext:
            return IdempotencyContext(
                key="replay-key",
                tenant_id=1,
                endpoint="POST /pos/transactions/{id}/items",
                request_hash="a" * 64,
                replay=True,
                cached_status=200,
                cached_body=cached_body,
            )

        pos_module._add_item_idempotency_dep = _replay_dep
        try:
            app = _make_app(mock_service, mock_session)
            with TestClient(app) as c:
                resp = c.post(
                    "/api/v1/pos/transactions/100/items",
                    json={"drug_code": "DRUG001", "quantity": "3"},
                    headers={"Idempotency-Key": "replay-key"},
                )
        finally:
            pos_module._add_item_idempotency_dep = original_dep

        assert resp.status_code == 201
        assert resp.json()["drug_code"] == "DRUG001"
        # Service must NOT be called on replay
        mock_service.add_item.assert_not_called()

    def test_add_item_different_key_proceeds(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        """Two different keys both succeed independently."""
        mock_service.get_transaction_detail.return_value = _txn_detail()
        mock_service.add_item.return_value = _cart_item()

        r1 = client.post(
            "/api/v1/pos/transactions/100/items",
            json={"drug_code": "DRUG001", "quantity": "3"},
            headers={"Idempotency-Key": "key-alpha"},
        )
        r2 = client.post(
            "/api/v1/pos/transactions/100/items",
            json={"drug_code": "DRUG001", "quantity": "3"},
            headers={"Idempotency-Key": "key-beta"},
        )
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert mock_service.add_item.call_count == 2


# ---------------------------------------------------------------------------
# update_item — requires Idempotency-Key
# ---------------------------------------------------------------------------


class TestUpdateItemIdempotency:
    def test_update_item_requires_idempotency_key(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        resp = client.patch(
            "/api/v1/pos/transactions/100/items/1",
            json={"quantity": "2"},
        )
        assert resp.status_code == 422
        mock_service.update_item.assert_not_called()

    def test_update_item_fresh_key_calls_service(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        mock_service.update_item.return_value = _cart_item()
        resp = client.patch(
            "/api/v1/pos/transactions/100/items/1",
            json={"quantity": "2"},
            headers={"Idempotency-Key": "update-key-001"},
        )
        assert resp.status_code == 200
        mock_service.update_item.assert_called_once()

    def test_update_item_replay_returns_cached(self, mock_service: MagicMock) -> None:
        cached_body: dict[str, Any] = _cart_item().model_dump(mode="json")

        from datapulse.api.routes import _pos_transactions as pos_module

        original_dep = pos_module._update_item_idempotency_dep

        async def _replay_dep(request: Request) -> IdempotencyContext:  # noqa: ARG001
            return IdempotencyContext(
                key="upd-replay",
                tenant_id=1,
                endpoint="PATCH /pos/transactions/{id}/items/{item_id}",
                request_hash="b" * 64,
                replay=True,
                cached_status=200,
                cached_body=cached_body,
            )

        pos_module._update_item_idempotency_dep = _replay_dep
        try:
            app = _make_app(mock_service)
            with TestClient(app) as c:
                resp = c.patch(
                    "/api/v1/pos/transactions/100/items/1",
                    json={"quantity": "2"},
                    headers={"Idempotency-Key": "upd-replay"},
                )
        finally:
            pos_module._update_item_idempotency_dep = original_dep

        assert resp.status_code == 200
        mock_service.update_item.assert_not_called()


# ---------------------------------------------------------------------------
# remove_item — requires Idempotency-Key
# ---------------------------------------------------------------------------


class TestRemoveItemIdempotency:
    def test_remove_item_requires_idempotency_key(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        resp = client.delete("/api/v1/pos/transactions/100/items/1")
        assert resp.status_code == 422
        mock_service.remove_item.assert_not_called()

    def test_remove_item_fresh_key_calls_service(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        mock_service.remove_item.return_value = True
        resp = client.delete(
            "/api/v1/pos/transactions/100/items/1",
            headers={"Idempotency-Key": "del-key-001"},
        )
        assert resp.status_code == 204
        mock_service.remove_item.assert_called_once()

    def test_remove_item_replay_returns_204_no_mutation(self, mock_service: MagicMock) -> None:
        from datapulse.api.routes import _pos_transactions as pos_module

        original_dep = pos_module._remove_item_idempotency_dep

        async def _replay_dep(request: Request) -> IdempotencyContext:  # noqa: ARG001
            return IdempotencyContext(
                key="del-replay",
                tenant_id=1,
                endpoint="DELETE /pos/transactions/{id}/items/{item_id}",
                request_hash="c" * 64,
                replay=True,
                cached_status=204,
                cached_body=None,
            )

        pos_module._remove_item_idempotency_dep = _replay_dep
        try:
            app = _make_app(mock_service)
            with TestClient(app) as c:
                resp = c.delete(
                    "/api/v1/pos/transactions/100/items/1",
                    headers={"Idempotency-Key": "del-replay"},
                )
        finally:
            pos_module._remove_item_idempotency_dep = original_dep

        assert resp.status_code == 204
        mock_service.remove_item.assert_not_called()

    def test_remove_item_404_on_missing_item(
        self, client: TestClient, mock_service: MagicMock
    ) -> None:
        mock_service.remove_item.return_value = False
        resp = client.delete(
            "/api/v1/pos/transactions/100/items/99",
            headers={"Idempotency-Key": "del-notfound"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Concurrent same-key → 409 (unit simulation via check_and_claim)
# ---------------------------------------------------------------------------


def test_concurrent_same_key_409() -> None:
    """Simulates the race: a second arrival with same key but different hash gets 409.

    This exercises check_and_claim's hash-mismatch branch, which is what the DB
    unique constraint causes in the concurrent case (the second request sees a
    row whose hash differs from its own).
    """
    import hashlib
    from datetime import UTC, datetime, timedelta
    from unittest.mock import MagicMock

    from fastapi import HTTPException

    from datapulse.pos.idempotency import check_and_claim

    h1 = hashlib.sha256(b"body1").hexdigest()
    h2 = hashlib.sha256(b"body2").hexdigest()

    session = MagicMock()
    session.execute.return_value.mappings.return_value.first.return_value = {
        "endpoint": "POST /pos/transactions/{id}/items",
        "request_hash": h1,
        "response_status": 200,
        "response_body": {"ok": True},
        "expires_at": datetime.now(UTC) + timedelta(hours=1),
    }

    with pytest.raises(HTTPException) as exc_info:
        check_and_claim(session, "same-key", 1, "POST /pos/transactions/{id}/items", h2)

    assert exc_info.value.status_code == 409


def test_add_item_replays_cached_failure_without_service_call(mock_service: MagicMock) -> None:
    """A failed idempotent add retry must replay the original 4xx, not validate as a cart."""
    from datapulse.api.routes import _pos_transactions as pos_module

    async def _replay_error_dep(request: Request) -> IdempotencyContext:  # noqa: ARG001
        return IdempotencyContext(
            key="add-failed-replay",
            tenant_id=1,
            endpoint="POST /pos/transactions/{id}/items",
            request_hash="d" * 64,
            replay=True,
            cached_status=409,
            cached_body={"detail": "Insufficient stock for DRUG001"},
        )

    app = _make_app(mock_service)
    app.dependency_overrides[pos_module._add_item_idempotency_dep] = _replay_error_dep
    with TestClient(app) as c:
        resp = c.post(
            "/api/v1/pos/transactions/100/items",
            json={"drug_code": "DRUG001", "quantity": "3"},
            headers={"Idempotency-Key": "add-failed-replay"},
        )

    assert resp.status_code == 409
    assert resp.json()["detail"] == "Insufficient stock for DRUG001"
    mock_service.add_item.assert_not_called()


@pytest.mark.asyncio
async def test_update_item_records_expected_pos_error(mock_service: MagicMock) -> None:
    from datapulse.api.routes import _pos_transactions as pos_module
    from datapulse.pos.exceptions import PosConflictError

    idem = IdempotencyContext(
        key="upd-fails",
        tenant_id=1,
        endpoint="PATCH /pos/transactions/{id}/items/{item_id}",
        request_hash="u" * 64,
        replay=False,
    )
    mock_service.update_item.side_effect = PosConflictError(
        "transaction_not_draft",
        message="Only draft transactions can be edited",
    )

    with (
        patch("datapulse.api.routes._pos_transactions.record_idempotent_exception") as record,
        pytest.raises(PosConflictError),
    ):
        await pos_module.update_item(
            request=MagicMock(),
            transaction_id=100,
            item_id=1,
            body=UpdateItemRequest(quantity=Decimal("2"), override_price="9.5", discount="1"),
            service=mock_service,
            user=MOCK_USER,
            db_session=MagicMock(),
            idem=idem,
        )

    record.assert_called_once()


@pytest.mark.asyncio
async def test_checkout_records_success_direct_call(mock_service: MagicMock) -> None:
    from datapulse.api.routes import _pos_transactions as pos_module
    from datapulse.pos.constants import PaymentMethod

    idem = IdempotencyContext(
        key="checkout-ok",
        tenant_id=1,
        endpoint="POST /pos/transactions/{id}/checkout",
        request_hash="c" * 64,
        replay=False,
    )
    mock_service.checkout.return_value = CheckoutResponse(
        transaction_id=100,
        receipt_number="R20260430-1-100",
        grand_total=Decimal("10"),
        payment_method=PaymentMethod.cash,
        change_due=Decimal("0"),
        status=TransactionStatus.completed,
    )

    with patch("datapulse.api.routes._pos_transactions.record_idempotent_success") as record:
        result = await pos_module.checkout(
            request=MagicMock(),
            transaction_id=100,
            body=CheckoutRequest(payment_method=PaymentMethod.cash, cash_tendered=Decimal("10")),
            service=mock_service,
            user=MOCK_USER,
            db_session=MagicMock(),
            idem=idem,
        )

    assert result.receipt_number == "R20260430-1-100"
    record.assert_called_once()


@pytest.mark.asyncio
async def test_checkout_records_http_exception_direct_call(mock_service: MagicMock) -> None:
    from datapulse.api.routes import _pos_transactions as pos_module
    from datapulse.pos.constants import PaymentMethod

    idem = IdempotencyContext(
        key="checkout-fail",
        tenant_id=1,
        endpoint="POST /pos/transactions/{id}/checkout",
        request_hash="h" * 64,
        replay=False,
    )
    mock_service.checkout.side_effect = HTTPException(status_code=409, detail="busy")

    with (
        patch("datapulse.api.routes._pos_transactions.record_idempotent_exception") as record,
        pytest.raises(HTTPException),
    ):
        await pos_module.checkout(
            request=MagicMock(),
            transaction_id=100,
            body=CheckoutRequest(payment_method=PaymentMethod.cash, cash_tendered=Decimal("10")),
            service=mock_service,
            user=MOCK_USER,
            db_session=MagicMock(),
            idem=idem,
        )

    record.assert_called_once()


@pytest.mark.asyncio
async def test_commit_transaction_records_terminal_mismatch() -> None:
    from datapulse.api.routes import _pos_transactions as pos_module
    from datapulse.pos.constants import PaymentMethod
    from datapulse.pos.devices import DeviceProof, TerminalDevice

    idem = IdempotencyContext(
        key="commit-mismatch",
        tenant_id=1,
        endpoint="POST /pos/transactions/commit",
        request_hash="m" * 64,
        replay=False,
    )
    payload = CommitRequest(
        terminal_id=2,
        shift_id=1,
        staff_id="staff-1",
        site_code="SITE01",
        items=[_cart_item()],
        subtotal=Decimal("37.5"),
        grand_total=Decimal("37.5"),
        payment_method=PaymentMethod.cash,
        cash_tendered=Decimal("40"),
    )
    proof = DeviceProof(
        terminal_id=1,
        device=TerminalDevice(
            id=1,
            tenant_id=1,
            terminal_id=1,
            public_key=b"x" * 32,
            device_fingerprint="sha256:" + "a" * 64,
            device_fingerprint_v2=None,
            revoked_at=None,
        ),
        signed_at=datetime.now(UTC),
        idempotency_key=idem.key,
    )

    with (
        patch("datapulse.api.routes._pos_transactions.record_idempotent_exception") as record,
        pytest.raises(HTTPException) as exc,
    ):
        await pos_module.commit_transaction(
            request=MagicMock(),
            payload=payload,
            user=MOCK_USER,
            db_session=MagicMock(),
            proof=proof,
            idem=idem,
        )

    assert exc.value.status_code == 400
    record.assert_called_once()


@pytest.mark.asyncio
async def test_commit_transaction_records_success() -> None:
    from datapulse.api.routes import _pos_transactions as pos_module
    from datapulse.pos.constants import PaymentMethod
    from datapulse.pos.devices import DeviceProof, TerminalDevice

    idem = IdempotencyContext(
        key="commit-ok",
        tenant_id=1,
        endpoint="POST /pos/transactions/commit",
        request_hash="o" * 64,
        replay=False,
    )
    payload = CommitRequest(
        terminal_id=1,
        shift_id=1,
        staff_id="staff-1",
        site_code="SITE01",
        items=[_cart_item()],
        subtotal=Decimal("37.5"),
        grand_total=Decimal("37.5"),
        payment_method=PaymentMethod.cash,
        cash_tendered=Decimal("40"),
    )
    proof = DeviceProof(
        terminal_id=1,
        device=TerminalDevice(
            id=1,
            tenant_id=1,
            terminal_id=1,
            public_key=b"x" * 32,
            device_fingerprint="sha256:" + "a" * 64,
            device_fingerprint_v2=None,
            revoked_at=None,
        ),
        signed_at=datetime.now(UTC),
        idempotency_key=idem.key,
    )
    response = CommitResponse(
        transaction_id=100,
        receipt_number="R20260430-1-100",
        commit_confirmed_at=datetime.now(UTC),
        change_due=Decimal("2.5"),
    )

    with (
        patch("datapulse.api.routes._pos_transactions.atomic_commit", return_value=response),
        patch("datapulse.api.routes._pos_transactions.record_idempotent_success") as record,
    ):
        result = await pos_module.commit_transaction(
            request=MagicMock(),
            payload=payload,
            user=MOCK_USER,
            db_session=MagicMock(),
            proof=proof,
            idem=idem,
        )

    assert result.transaction_id == 100
    record.assert_called_once()
