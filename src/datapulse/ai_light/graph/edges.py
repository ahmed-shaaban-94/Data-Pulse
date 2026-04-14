"""Conditional edge functions for the AI-Light LangGraph.

Each function receives the current state and returns a node name string.
LangGraph calls these after each node to determine the next step.
"""

from __future__ import annotations

_MAX_VALIDATE_RETRIES = 2


def route_by_type(state: dict) -> str:
    """Route from the dummy `route` node to the appropriate plan_* node."""
    insight_type = state.get("insight_type", "summary")
    routes = {
        "summary": "plan_summary",
        "anomalies": "plan_anomalies",
        "changes": "plan_changes",
        "deep_dive": "plan_deep_dive",
    }
    return routes.get(insight_type, "plan_summary")


def cache_or_continue(state: dict) -> str:
    """After cache_check: END (cache hit) or continue to route."""
    return "__end__" if state.get("cache_hit") else "route"


def validate_or_retry(state: dict) -> str:
    """After validate: retry analyze, fall back, or proceed to synthesize."""
    retries = state.get("validation_retries", 0)
    parsed = state.get("llm_parsed_output")

    if parsed is not None and retries <= _MAX_VALIDATE_RETRIES:
        # Check if the last validate step reported an error
        trace = state.get("step_trace", [])
        last_validate = next(
            (s for s in reversed(trace) if s.get("node") == "validate"),
            None,
        )
        if last_validate and last_validate.get("status") == "ok":
            return "synthesize"
        if retries >= _MAX_VALIDATE_RETRIES:
            return "fallback"
        return "analyze"

    if retries >= _MAX_VALIDATE_RETRIES:
        return "fallback"
    if parsed is None:
        return "fallback" if retries >= _MAX_VALIDATE_RETRIES else "analyze"
    return "synthesize"


def circuit_breaker_check(state: dict) -> str:
    """After fetch_data: check if circuit is open (too many consecutive failures)."""
    failures = state.get("circuit_breaker_failures", 0)
    if failures >= 3:
        return "fallback"
    return "analyze"
