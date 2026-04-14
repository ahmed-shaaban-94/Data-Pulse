"""Pydantic models for AI-Light insights.

Phase D additions:
- DeepDiveRequest: adds require_review flag and stream flag
- AIInsightMeta: run-level observability (run_id, model, tokens, cost, duration)
- DeepDiveResponse: composite deep-dive result (narrative + highlights + anomalies + deltas)
- DeepDiveDraft: 202 Accepted response when require_review=True (HITL paused run)
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from datapulse.types import JsonDecimal


class InsightRequest(BaseModel):
    """Request body for generating AI insights."""

    model_config = ConfigDict(frozen=True)

    insight_type: str = Field(description="Type of insight: 'summary', 'anomalies', or 'changes'")
    start_date: date | None = None
    end_date: date | None = None


class AISummary(BaseModel):
    """AI-generated narrative summary of analytics data."""

    model_config = ConfigDict(frozen=True)

    narrative: str
    highlights: list[str]
    period: str


class Anomaly(BaseModel):
    """A detected anomaly in the data."""

    model_config = ConfigDict(frozen=True)

    date: str
    metric: str
    actual_value: JsonDecimal
    expected_range_low: JsonDecimal
    expected_range_high: JsonDecimal
    severity: str = Field(description="low, medium, or high")
    description: str


class AnomalyReport(BaseModel):
    """Collection of detected anomalies."""

    model_config = ConfigDict(frozen=True)

    anomalies: list[Anomaly]
    period: str
    total_checked: int


class ChangeDelta(BaseModel):
    """A single metric change between two periods."""

    model_config = ConfigDict(frozen=True)

    metric: str
    previous_value: JsonDecimal
    current_value: JsonDecimal
    change_pct: JsonDecimal
    direction: str  # "up", "down", "flat"


class ChangeNarrative(BaseModel):
    """AI-generated explanation of changes between periods."""

    model_config = ConfigDict(frozen=True)

    narrative: str
    deltas: list[ChangeDelta]
    current_period: str
    previous_period: str


# ---------------------------------------------------------------------------
# Phase D models
# ---------------------------------------------------------------------------


class DeepDiveRequest(BaseModel):
    """Request body for the composite /deep-dive endpoint."""

    model_config = ConfigDict(frozen=True)

    insight_type: str = Field(default="deep_dive", description="Always 'deep_dive'")
    start_date: date | None = None
    end_date: date | None = None
    require_review: bool = Field(
        default=False,
        description=(
            "When True the graph pauses before synthesize and returns 202 Accepted "
            "with a run_id.  The caller must then GET /review/{run_id} to inspect the "
            "draft and POST /review/{run_id}/approve to resume."
        ),
    )
    stream: bool = Field(
        default=False,
        description=(
            "When True returns an SSE stream of node-level events instead of a JSON response."
        ),
    )


class AIInsightMeta(BaseModel):
    """Run-level observability attached to deep-dive responses."""

    model_config = ConfigDict(frozen=True)

    run_id: str
    model: str
    tokens: int
    cost_cents: float
    degraded: bool
    duration_ms: int


class DeepDiveResponse(BaseModel):
    """Full composite deep-dive result."""

    model_config = ConfigDict(frozen=True)

    narrative: str
    highlights: list[str]
    anomalies_list: list[dict]
    deltas: list[dict]
    degraded: bool
    meta: AIInsightMeta


class DeepDiveDraft(BaseModel):
    """202 Accepted response when require_review=True.

    Contains enough information for an analyst to review the draft before
    approving.  The run_id is required for the /review and /approve endpoints.
    """

    model_config = ConfigDict(frozen=True)

    run_id: str
    tenant_id: str
    narrative_draft: str
    highlights_draft: list[str]
    data_snapshot: dict
    step_trace: list[dict]


class ApproveRequest(BaseModel):
    """Body for POST /review/{run_id}/approve.

    edits overrides specific keys in the draft (e.g. narrative, highlights).
    Leave empty to approve as-is.
    """

    model_config = ConfigDict(frozen=True)

    narrative: str | None = None
    highlights: list[str] | None = None
