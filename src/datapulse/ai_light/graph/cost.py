"""Token→cost mapping and invocation tracking for the AI Light graph."""

from __future__ import annotations

from typing import TYPE_CHECKING

from datapulse.logging import get_logger

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

log = get_logger(__name__)

# Cost per 1 million tokens in USD cents (as of 2025-Q4).
# Only models used via OpenRouter are listed here; add more as needed.
_COST_PER_MILLION: dict[str, dict[str, float]] = {
    "openai/gpt-4o-mini": {"input": 15.0, "output": 60.0},
    "openai/gpt-4o": {"input": 250.0, "output": 1000.0},
    "anthropic/claude-3-5-haiku": {"input": 80.0, "output": 400.0},
    "anthropic/claude-3-5-sonnet": {"input": 300.0, "output": 1500.0},
    "openrouter/free": {"input": 0.0, "output": 0.0},
}

_DEFAULT_COST = {"input": 200.0, "output": 800.0}  # conservative estimate


def compute_cost_cents(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return cost in USD cents for a model invocation."""
    rates = _COST_PER_MILLION.get(model, _DEFAULT_COST)
    return (input_tokens * rates["input"] + output_tokens * rates["output"]) / 1_000_000


def write_invocation_row(
    session: Session,
    *,
    run_id: str,
    insight_type: str,
    model: str,
    token_usage: dict[str, int],
    cost_cents: float,
    duration_ms: int,
    status: str = "success",
    error_message: str | None = None,
    tenant_id: int = 1,
) -> None:
    """Insert one row into public.ai_invocations (best-effort — never raises)."""
    from sqlalchemy import text

    try:
        session.execute(
            text("""
                INSERT INTO public.ai_invocations
                    (tenant_id, run_id, insight_type, model,
                     input_tokens, output_tokens, cost_cents,
                     duration_ms, status, error_message)
                VALUES
                    (:tenant_id, :run_id, :insight_type, :model,
                     :input_tokens, :output_tokens, :cost_cents,
                     :duration_ms, :status, :error_message)
            """),
            {
                "tenant_id": tenant_id,
                "run_id": run_id,
                "insight_type": insight_type,
                "model": model,
                "input_tokens": token_usage.get("input", 0),
                "output_tokens": token_usage.get("output", 0),
                "cost_cents": cost_cents,
                "duration_ms": duration_ms,
                "status": status,
                "error_message": error_message,
            },
        )
        session.commit()
    except Exception as exc:
        log.warning("ai_invocation_write_failed", error=str(exc))
        session.rollback()
