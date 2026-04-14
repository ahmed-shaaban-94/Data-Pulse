"""AI-Light module — summaries, anomaly detection, change narratives via OpenRouter."""

from datapulse.ai_light.service import AILightService

__all__ = ["AILightService", "AILightGraphService"]


def __getattr__(name: str) -> object:
    if name == "AILightGraphService":
        from datapulse.ai_light.graph_service import AILightGraphService

        return AILightGraphService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
