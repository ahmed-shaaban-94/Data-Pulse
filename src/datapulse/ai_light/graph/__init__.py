"""AI Light graph sub-package.

Exports the graph builder and state type for external consumers.
Heavy imports (langgraph, langchain_core) are deferred to runtime
so that the package can be imported without the [ai] extras installed.
"""

from __future__ import annotations

from datapulse.ai_light.graph.state import AILightState

__all__ = ["AILightState", "build_graph"]


def build_graph(session: object, settings: object) -> object:
    """Lazy proxy — imports langgraph only when called."""
    from datapulse.ai_light.graph.builder import build_graph as _build

    return _build(session, settings)  # type: ignore[arg-type]
