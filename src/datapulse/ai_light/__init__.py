"""AI-Light module — summaries, anomaly detection, change narratives via OpenRouter.

Phase D: LangGraph orchestration, HITL approval, SSE streaming.
"""

from datapulse.ai_light.service import AILightService

__all__ = ["AILightService"]

# AILightGraphService and build_graph are lazy-imported in deps.py to keep
# langgraph out of the critical import path when the feature flag is off.
