"""Single-terminal enforcement tests — minimal app + mocked session.

Covers:
  * GET /pos/terminals/active-for-me — returns tenant state + multi_terminal_allowed
  * POST /pos/terminals — returns 409 when active_count >= pos_max_terminals
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from datapulse.api.auth import get_current_user
from datapulse.api.deps import get_pos_service, get_tenant_plan_limits, get_tenant_session
from datapulse.billing.plans import PLAN_LIMITS
from datapulse.pos.exceptions import PosError
from datapulse.rbac.dependencies import get_access_context
from datapulse.rbac.models import AccessContext

pytestmark = pytest.mark.unit


_MOCK_USER: dict[str, Any] = {
    "sub": "test-user",
    "email": "test@datapulse.local",
    "tenant_id": "1",
    "roles": ["admin"],
    "raw_claims": {},
}


def _make_app(session_stub, service_stub: MagicMock | None = None) -> FastAPI:
    from datapulse.api.routes.pos import router as pos_router

    app = FastAPI()

    @app.exception_handler(PosError)
    async def _pos_err(_req: Request, exc: PosError):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    app.include_router(pos_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: _MOCK_USER
    app.dependency_overrides[get_tenant_session] = lambda: session_stub
    app.dependency_overrides[get_pos_service] = lambda: service_stub or MagicMock()
    app.dependency_overrides[get_tenant_plan_limits] = lambda: PLAN_LIMITS["platform"]
    app.dependency_overrides[get_access_context] = lambda: AccessContext(
        member_id=1,
        tenant_id=1,
        user_id="test-user",
        role_key="admin",
        permissions={"pos:terminal:open"},
        is_admin=True,
    )
    return app


def test_active_for_me_returns_caller_terminals() -> None:
    session = MagicMock()

    def _execute(stmt, params=None):  # noqa: ARG001
        sql = str(stmt)
        if "terminal_sessions" in sql and "terminal_devices" in sql:
            m = MagicMock()
            m.mappings.return_value.all.return_value = [
                {
                    "terminal_id": 42,
                    "device_fingerprint": None,
                    "opened_at": datetime(2026, 4, 17, 6, 0, tzinfo=UTC),
                }
            ]
            return m
        if "bronze.tenants" in sql:
            m = MagicMock()
            m.mappings.return_value.first.return_value = {
                "pos_multi_terminal_allowed": False,
                "pos_max_terminals": 1,
            }
            return m
        return MagicMock()

    session.execute.side_effect = _execute

    client = TestClient(_make_app(session))
    r = client.get(
        "/api/v1/pos/terminals/active-for-me",
        headers={"X-API-Key": "test-api-key"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["multi_terminal_allowed"] is False
    assert body["max_terminals"] == 1
    assert body["active_terminals"][0]["terminal_id"] == 42


def test_open_terminal_409_when_cap_reached() -> None:
    session = MagicMock()

    def _execute(stmt, params=None):  # noqa: ARG001
        sql = str(stmt)
        scalar_mock = MagicMock()
        if "pos_max_terminals" in sql:
            scalar_mock.scalar.return_value = 1
            return scalar_mock
        if "count(*)" in sql and "terminal_sessions" in sql:
            scalar_mock.scalar.return_value = 1  # already at cap
            return scalar_mock
        return MagicMock()

    session.execute.side_effect = _execute
    service = MagicMock()

    client = TestClient(_make_app(session, service))
    r = client.post(
        "/api/v1/pos/terminals",
        json={"site_code": "S1", "terminal_name": "T2", "opening_cash": "0.00"},
        headers={"X-API-Key": "test-api-key"},
    )
    assert r.status_code == 409, r.text
    assert "multi_terminal_limit_reached" in r.json()["detail"]
    service.open_terminal.assert_not_called()


def test_open_terminal_passes_when_under_cap() -> None:
    from datetime import datetime as _dt
    from decimal import Decimal

    from datapulse.pos.constants import TerminalStatus
    from datapulse.pos.models import TerminalSession

    session = MagicMock()

    def _execute(stmt, params=None):  # noqa: ARG001
        sql = str(stmt)
        scalar_mock = MagicMock()
        if "pos_max_terminals" in sql:
            scalar_mock.scalar.return_value = 1
            return scalar_mock
        if "count(*)" in sql and "terminal_sessions" in sql:
            scalar_mock.scalar.return_value = 0
            return scalar_mock
        return MagicMock()

    session.execute.side_effect = _execute

    service = MagicMock()
    service.open_terminal.return_value = TerminalSession(
        id=5,
        tenant_id=1,
        site_code="S1",
        staff_id="test-user",
        terminal_name="T1",
        status=TerminalStatus.open,
        opened_at=_dt(2026, 4, 17, 6, 0, tzinfo=UTC),
        opening_cash=Decimal("0.00"),
    )

    client = TestClient(_make_app(session, service))
    r = client.post(
        "/api/v1/pos/terminals",
        json={"site_code": "S1", "terminal_name": "T1", "opening_cash": "0.00"},
        headers={"X-API-Key": "test-api-key"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["id"] == 5
    service.open_terminal.assert_called_once()
