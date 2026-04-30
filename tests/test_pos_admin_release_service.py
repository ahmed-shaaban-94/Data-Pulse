"""Unit tests for ``datapulse.pos.admin_release_service.upsert_release``.

These tests stub the SQLAlchemy ``Session`` and assert:
1. The right SQL parameters are bound on insert.
2. The function returns a ``DesktopReleaseResponse`` populated from the
   ``RETURNING`` row.
3. The function strips the leading ``v`` from versions like ``v2.0.0``
   (delegated to the Pydantic model — verified end-to-end here).
4. ``session.commit()`` is invoked so the workflow sees the row before
   curl exits.
5. The ``ON CONFLICT (version, channel, platform) DO UPDATE`` clause is
   present in the issued SQL — guards against an accidental edit that
   would turn the upsert into a plain insert.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from datapulse.pos.admin_release_service import upsert_release
from datapulse.pos.models.admin_release import DesktopReleaseCreate

pytestmark = pytest.mark.unit


def _mock_session(returned_row: dict) -> MagicMock:
    """Build a Session whose ``.execute(...).mappings().one()`` returns ``returned_row``."""
    session = MagicMock()
    session.execute.return_value.mappings.return_value.one.return_value = returned_row
    return session


def _row(**overrides) -> dict:
    """Default row shape echoed back by the RETURNING clause."""
    base = {
        "release_id": 42,
        "version": "9.9.0",
        "channel": "stable",
        "platform": "win32",
        "rollout_scope": "all",
        "active": True,
        "release_notes": None,
        "min_app_version": None,
        "min_schema_version": None,
        "max_schema_version": None,
        "created_at": datetime(2026, 4, 30, tzinfo=UTC),
        "updated_at": datetime(2026, 4, 30, tzinfo=UTC),
    }
    base.update(overrides)
    return base


def test_upsert_release_returns_response_from_row() -> None:
    session = _mock_session(_row(release_id=99, version="9.9.0"))
    payload = DesktopReleaseCreate(version="9.9.0")

    result = upsert_release(session, payload)

    assert result.release_id == 99
    assert result.version == "9.9.0"
    assert result.channel == "stable"
    assert result.platform == "win32"
    assert result.rollout_scope == "all"
    assert result.active is True


def test_upsert_release_binds_payload_params() -> None:
    session = _mock_session(_row(release_notes="auto-registered"))
    payload = DesktopReleaseCreate(
        version="9.9.1",
        channel="beta",
        platform="darwin",
        rollout_scope="selected",
        active=False,
        release_notes="auto-registered",
        min_app_version="1.0.0",
        min_schema_version=3,
        max_schema_version=5,
    )

    upsert_release(session, payload)

    args, kwargs = session.execute.call_args
    bound = args[1] if len(args) > 1 else kwargs.get("params") or kwargs
    assert bound == {
        "version": "9.9.1",
        "channel": "beta",
        "platform": "darwin",
        "rollout_scope": "selected",
        "active": False,
        "release_notes": "auto-registered",
        "min_app_version": "1.0.0",
        "min_schema_version": 3,
        "max_schema_version": 5,
    }


def test_upsert_release_sql_uses_on_conflict_idempotent_clause() -> None:
    """Guard against accidental edits that would drop the upsert semantics."""
    session = _mock_session(_row())
    upsert_release(session, DesktopReleaseCreate(version="9.9.2"))

    args, _ = session.execute.call_args
    sql_text = str(args[0])
    assert "ON CONFLICT (version, channel, platform) DO UPDATE" in sql_text
    assert "RETURNING" in sql_text


def test_upsert_release_strips_v_prefix_from_version() -> None:
    session = _mock_session(_row(version="9.9.3"))
    payload = DesktopReleaseCreate(version="v9.9.3")

    upsert_release(session, payload)

    args, _ = session.execute.call_args
    bound = args[1] if len(args) > 1 else {}
    assert bound["version"] == "9.9.3"


def test_upsert_release_commits_session() -> None:
    session = _mock_session(_row())
    upsert_release(session, DesktopReleaseCreate(version="9.9.4"))
    session.commit.assert_called_once()
