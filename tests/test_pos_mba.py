"""Unit tests for Market Basket Analysis engine (pos/mba.py).

All tests mock the SQLAlchemy session — no database required.
Covers: empty baskets, single-pair result, multi-pair with stale delete,
confidence/reason Arabic text, zero stale rows, constants export.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from datapulse.pos.mba import (
    MIN_CONFIDENCE,
    MIN_SUPPORT,
    TOP_N_PER_DRUG,
    MBARule,
    run_mba,
)

# ── helpers ───────────────────────────────────────────────────────────────────


def _row(primary: str, suggested: str, support_count: int, confidence: float):
    """Fake SQLAlchemy result row."""
    return SimpleNamespace(
        primary_drug_code=primary,
        suggested_drug_code=suggested,
        support_count=support_count,
        confidence=confidence,
    )


def _mock_session(mine_rows: list, stale_rowcount: int = 0) -> MagicMock:
    """Build a mock Session that returns mine_rows on the first fetchall()."""
    session = MagicMock()

    # execute() is called multiple times:
    #   1. SET LOCAL app.tenant_id
    #   2. _MINE_SQL → returns fetchable result
    #   3. _UPSERT_SQL × len(mine_rows)
    #   4. _DELETE_STALE_SQL → rowcount

    mine_result = MagicMock()
    mine_result.fetchall.return_value = mine_rows

    stale_result = MagicMock()
    stale_result.rowcount = stale_rowcount

    # Side-effect: first execute returns None (SET LOCAL), second returns
    # mine_result, subsequent upsert calls return MagicMock(), final call
    # returns stale_result.
    call_count = [0]

    def _execute(sql, params=None):  # noqa: ARG001
        call_count[0] += 1
        if call_count[0] == 1:
            return MagicMock()  # SET LOCAL
        if call_count[0] == 2:
            return mine_result  # _MINE_SQL
        if call_count[0] == 2 + len(mine_rows) + 1:
            return stale_result  # _DELETE_STALE_SQL
        return MagicMock()  # _UPSERT_SQL calls

    session.execute.side_effect = _execute
    return session


# ── tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_constants_exported():
    assert MIN_SUPPORT == 3
    assert pytest.approx(0.05) == MIN_CONFIDENCE
    assert TOP_N_PER_DRUG == 5


@pytest.mark.unit
def test_mba_rule_dataclass():
    rule = MBARule(
        primary_drug_code="AMX500",
        suggested_drug_code="IBU400",
        support_count=10,
        confidence=0.75,
    )
    assert rule.primary_drug_code == "AMX500"
    assert rule.confidence == pytest.approx(0.75)


@pytest.mark.unit
def test_run_mba_empty_baskets():
    """No rows mined → nothing upserted, returns zeros."""
    session = _mock_session(mine_rows=[])
    result = run_mba(session, tenant_id=1)

    assert result == {"rules_found": 0, "rules_upserted": 0, "stale_deleted": 0}
    session.commit.assert_called_once()


@pytest.mark.unit
def test_run_mba_single_pair():
    """One pair mined → one upsert, correct stats."""
    rows = [_row("AMX500", "IBU400", support_count=5, confidence=0.25)]
    session = _mock_session(mine_rows=rows)

    result = run_mba(session, tenant_id=1)

    assert result["rules_found"] == 1
    assert result["rules_upserted"] == 1
    assert result["stale_deleted"] == 0
    session.commit.assert_called_once()


@pytest.mark.unit
def test_run_mba_multi_pairs():
    """Three pairs → three upserts."""
    rows = [
        _row("AMX500", "IBU400", 8, 0.40),
        _row("AMX500", "VIT_C", 6, 0.30),
        _row("IBU400", "PARA", 4, 0.20),
    ]
    session = _mock_session(mine_rows=rows)

    result = run_mba(session, tenant_id=42)

    assert result["rules_found"] == 3
    assert result["rules_upserted"] == 3


@pytest.mark.unit
def test_run_mba_stale_deleted():
    """Stale-delete rowcount propagates to return value."""
    rows = [_row("X", "Y", 5, 0.10)]
    session = _mock_session(mine_rows=rows, stale_rowcount=3)

    result = run_mba(session, tenant_id=1)

    assert result["stale_deleted"] == 3


@pytest.mark.unit
def test_run_mba_reason_arabic_text():
    """Reason string contains Arabic percentage text."""
    rows = [_row("AMX500", "IBU400", 7, 0.35)]

    # Capture the params passed to the upsert execute call
    session = MagicMock()
    mine_result = MagicMock()
    mine_result.fetchall.return_value = rows
    stale_result = MagicMock()
    stale_result.rowcount = 0

    call_count = [0]
    upsert_params: list[dict] = []

    def _execute(sql, params=None):
        call_count[0] += 1
        if call_count[0] == 1:
            return MagicMock()
        if call_count[0] == 2:
            return mine_result
        if call_count[0] == 4:
            return stale_result
        # This is the upsert call
        if params:
            upsert_params.append(dict(params))
        return MagicMock()

    session.execute.side_effect = _execute

    run_mba(session, tenant_id=1)

    assert upsert_params, "Upsert should have been called"
    reason = upsert_params[0]["reason"]
    # Should contain the Arabic percentage marker
    assert "٪" in reason
    # Should contain "35" (35% confidence)
    assert "35" in reason


@pytest.mark.unit
def test_run_mba_uses_tenant_id_in_rls():
    """SET LOCAL is called with the correct tenant_id."""
    session = _mock_session(mine_rows=[])
    run_mba(session, tenant_id=99)

    first_call = session.execute.call_args_list[0]
    # The RLS call passes tid='99'
    assert "99" in str(first_call)


@pytest.mark.unit
def test_run_mba_custom_params_forwarded():
    """Custom min_support / min_confidence / top_n are forwarded to the mine query."""
    session = _mock_session(mine_rows=[])
    run_mba(session, tenant_id=1, min_support=10, min_confidence=0.2, top_n=3, lookback_days=30)

    # Second execute call is _MINE_SQL — check its params dict
    mine_call = session.execute.call_args_list[1]
    mine_params = mine_call[0][1] if len(mine_call[0]) > 1 else {}
    assert mine_params.get("min_support") == 10
    assert mine_params.get("min_confidence") == pytest.approx(0.2)
    assert mine_params.get("top_n") == 3
    assert mine_params.get("lookback_days") == 30
