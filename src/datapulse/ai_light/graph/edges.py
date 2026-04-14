"""Conditional edge functions for the AI Light LangGraph."""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from datapulse.ai_light.graph.state import AILightState

_MAX_RETRIES = 2


def route_by_type(
    state: AILightState,
) -> Literal["plan_summary", "plan_anomalies", "plan_changes"]:
    """Route after cache_check → plan_* based on insight_type."""
    insight = state.get("insight_type", "summary")
    if insight == "anomalies":
        return "plan_anomalies"
    if insight == "changes":
        return "plan_changes"
    return "plan_summary"


def validate_or_retry(
    state: AILightState,
) -> Literal["synthesize", "analyze", "fallback"]:
    """Route after validate node.

    - No errors → synthesize
    - errors AND retries < MAX_RETRIES → analyze (retry)
    - errors AND retries >= MAX_RETRIES → fallback
    """
    retries = state.get("validation_retries") or 0
    errors = state.get("errors") or []
    parsed = state.get("llm_parsed_output")

    # Validation succeeded when parsed output is present and no recent error
    if parsed is not None and not any("validation:" in e or "json_parse:" in e for e in errors):
        return "synthesize"

    if retries < _MAX_RETRIES:
        return "analyze"
    return "fallback"
