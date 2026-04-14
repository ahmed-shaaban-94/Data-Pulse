"""LangGraph orchestration package for AI-Light insights (Phase A–D).

Exports:
    build_graph   — compile the LangGraph StateGraph (call once at startup)
    AILightState  — TypedDict used as the shared state between nodes
"""

from datapulse.ai_light.graph.builder import build_graph
from datapulse.ai_light.graph.state import AILightState

__all__ = ["build_graph", "AILightState"]
