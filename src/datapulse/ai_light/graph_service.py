"""AILightGraphService — LangGraph-backed implementation of AILightServiceProtocol.

Implements the same 3-method interface as AILightService so that
``api/deps.py`` can swap between them transparently using the
``AI_LIGHT_USE_LANGGRAPH`` feature flag.

The graph is built per-request (closures capture the RLS session), compiled
at call time, and discarded afterwards. Compilation is O(nodes) ≈ 5 ms.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from datapulse.ai_light.models import (
    AISummary,
    Anomaly,
    AnomalyReport,
    ChangeDelta,
    ChangeNarrative,
)
from datapulse.config import Settings
from datapulse.logging import get_logger

log = get_logger(__name__)


class AILightGraphService:
    """LangGraph-backed AI insights service.

    Drop-in replacement for ``AILightService``. The three public methods
    (``generate_summary``, ``detect_anomalies``, ``explain_changes``) return
    the same Pydantic models as the original service.
    """

    def __init__(self, settings: Settings, session: Session) -> None:
        self._settings = settings
        self._session = session

    @property
    def is_available(self) -> bool:
        return bool(self._settings.openrouter_api_key)

    # ── internal graph runner ─────────────────────────────────────────────

    def _run_graph(self, initial_state: dict[str, Any]) -> dict[str, Any]:
        """Build graph, invoke with *initial_state*, return final state."""
        try:
            from datapulse.ai_light.graph.builder import build_graph

            graph = build_graph(self._session, self._settings)
            result: dict[str, Any] = graph.invoke(initial_state)
            return result
        except ImportError:
            log.error(
                "langgraph_not_installed",
                detail="Install datapulse[ai] to use the graph service",
            )
            raise
        except Exception as exc:
            log.error("graph_run_failed", error=str(exc))
            raise

    def _base_state(self, insight_type: str) -> dict[str, Any]:
        return {
            "insight_type": insight_type,
            "run_id": str(uuid.uuid4()),
            "tenant_id": "1",  # overridden by RLS session — default for safety
            "validation_retries": 0,
            "circuit_breaker_failures": 0,
            "cache_hit": False,
            "degraded": False,
            "step_trace": [],
            "errors": [],
        }

    # ── public methods ────────────────────────────────────────────────────

    def generate_summary(self, target_date: date | None = None) -> AISummary:
        """Generate an executive summary via the graph."""
        target = target_date or date.today()
        state = {
            **self._base_state("summary"),
            "target_date": target,
        }
        result = self._run_graph(state)

        narrative = result.get("narrative") or "Summary unavailable."
        highlights = result.get("highlights") or ["No highlights available."]
        return AISummary(
            narrative=narrative,
            highlights=list(highlights),
            period=target.isoformat(),
        )

    def detect_anomalies(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> AnomalyReport:
        """Detect anomalies via the graph.

        Falls back gracefully to an empty report if the graph fails or
        returns insufficient data. The response shape is always AnomalyReport
        regardless of whether degraded=True.
        """
        end = end_date or date.today()
        start = start_date or (end - timedelta(days=30))

        state = {
            **self._base_state("anomalies"),
            "start_date": start,
            "end_date": end,
        }

        try:
            result = self._run_graph(state)
        except Exception as exc:
            log.error("detect_anomalies_graph_failed", error=str(exc))
            return AnomalyReport(
                anomalies=[],
                period=f"{start} to {end}",
                total_checked=0,
            )

        raw_list = result.get("anomalies_list") or []
        anomalies: list[Anomaly] = []
        stat = result.get("statistical_analysis") or {}
        avg = stat.get("avg", 0)
        std = stat.get("std", 0)

        for item in raw_list:
            if not isinstance(item, dict):
                continue
            severity = str(item.get("severity", "low"))
            if severity not in ("low", "medium", "high"):
                severity = "low"
            anomalies.append(
                Anomaly(
                    date=str(item.get("date", "")),
                    metric="daily_net_sales",
                    actual_value=Decimal("0"),
                    expected_range_low=Decimal(str(round(avg - 2 * std, 2))),
                    expected_range_high=Decimal(str(round(avg + 2 * std, 2))),
                    severity=severity,
                    description=str(item.get("description", ""))[:500],
                )
            )

        return AnomalyReport(
            anomalies=anomalies,
            period=f"{start} to {end}",
            total_checked=stat.get("count", 0),
        )

    def explain_changes(
        self,
        current_date: date | None = None,
        previous_date: date | None = None,
    ) -> ChangeNarrative:
        """Explain period-over-period changes via the graph."""
        current = current_date or date.today()
        previous = previous_date or (current - timedelta(days=30))

        state = {
            **self._base_state("changes"),
            "current_date": current,
            "previous_date": previous,
        }

        try:
            result = self._run_graph(state)
        except Exception as exc:
            log.error("explain_changes_graph_failed", error=str(exc))
            return ChangeNarrative(
                narrative="Change analysis unavailable.",
                deltas=[],
                current_period=current.isoformat(),
                previous_period=previous.isoformat(),
            )

        narrative = result.get("narrative") or "Change analysis unavailable."
        raw_deltas = result.get("deltas") or []
        deltas: list[ChangeDelta] = []

        for d in raw_deltas:
            if not isinstance(d, dict):
                continue
            direction = str(d.get("direction", "flat"))
            if direction not in ("up", "down", "flat"):
                direction = "flat"
            deltas.append(
                ChangeDelta(
                    metric=str(d.get("metric", "")),
                    previous_value=Decimal(str(d.get("previous_value", 0))),
                    current_value=Decimal(str(d.get("current_value", 0))),
                    change_pct=Decimal(str(d.get("change_pct", 0))),
                    direction=direction,
                )
            )

        return ChangeNarrative(
            narrative=narrative,
            deltas=deltas,
            current_period=current.isoformat(),
            previous_period=previous.isoformat(),
        )
