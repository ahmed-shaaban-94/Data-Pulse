"""Build and compile the AI Light LangGraph.

The graph is compiled once per *request* because node closures capture the
per-request RLS session. Graph compilation is O(nodes) — typically <5 ms.

Usage::

    graph = build_graph(session, settings)
    result = graph.invoke(initial_state)
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from datapulse.config import Settings


def build_graph(session: Session, settings: Settings) -> Any:
    """Compile and return a LangGraph StateGraph for AI Light.

    Raises ``ImportError`` if langgraph is not installed. The caller
    (AILightGraphService) guards this with the feature flag.
    """
    from langgraph.graph import END, START, StateGraph  # type: ignore[import]

    from datapulse.ai_light.client import OpenRouterClient
    from datapulse.ai_light.graph.edges import route_by_type, validate_or_retry
    from datapulse.ai_light.graph.nodes import (
        fallback,
        make_analyze_node,
        make_cost_track_node,
        make_fetch_data_node,
        plan_anomalies,
        plan_changes,
        plan_summary,
        synthesize,
        validate,
    )
    from datapulse.ai_light.graph.state import AILightState
    from datapulse.ai_light.graph.tools import build_tool_registry

    client = OpenRouterClient(settings)
    tools = build_tool_registry(session, settings)
    start_time_ref: list[float] = [time.time()]

    fetch_data = make_fetch_data_node(tools)
    analyze = make_analyze_node(client, settings)
    cost_track = make_cost_track_node(session, start_time_ref)

    graph = StateGraph(AILightState)

    # Add nodes
    graph.add_node("plan_summary", plan_summary)
    graph.add_node("plan_anomalies", plan_anomalies)
    graph.add_node("plan_changes", plan_changes)
    graph.add_node("fetch_data", fetch_data)
    graph.add_node("analyze", analyze)
    graph.add_node("validate", validate)
    graph.add_node("synthesize", synthesize)
    graph.add_node("fallback", fallback)
    graph.add_node("cost_track", cost_track)

    # Entry: route to the correct plan node
    graph.add_conditional_edges(
        START,
        route_by_type,
        {
            "plan_summary": "plan_summary",
            "plan_anomalies": "plan_anomalies",
            "plan_changes": "plan_changes",
        },
    )

    # Plan nodes → fetch_data
    graph.add_edge("plan_summary", "fetch_data")
    graph.add_edge("plan_anomalies", "fetch_data")
    graph.add_edge("plan_changes", "fetch_data")

    # fetch_data → analyze
    graph.add_edge("fetch_data", "analyze")

    # analyze → validate
    graph.add_edge("analyze", "validate")

    # validate → synthesize | analyze (retry) | fallback
    graph.add_conditional_edges(
        "validate",
        validate_or_retry,
        {
            "synthesize": "synthesize",
            "analyze": "analyze",
            "fallback": "fallback",
        },
    )

    # synthesize / fallback → cost_track → END
    graph.add_edge("synthesize", "cost_track")
    graph.add_edge("fallback", "cost_track")
    graph.add_edge("cost_track", END)

    return graph.compile()
