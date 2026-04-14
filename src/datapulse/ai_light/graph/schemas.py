"""Pydantic validation schemas for LangGraph node output validation.

Used by the `validate` node to enforce structure before synthesize.
On schema failure the graph retries analyze (up to 2 times) then falls back
to stats-only output.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class _BaseOutput(BaseModel):
    class Config:
        extra = "allow"  # tolerate extra LLM fields gracefully


class SummaryOutput(_BaseOutput):
    narrative: str = Field(min_length=10)
    highlights: list[str] = Field(min_length=1)


class AnomalyItem(_BaseOutput):
    date: str
    severity: str
    description: str


class AnomalyOutput(_BaseOutput):
    anomalies: list[AnomalyItem] = Field(default_factory=list)


class DeltaItem(_BaseOutput):
    metric: str
    previous_value: float
    current_value: float
    change_pct: float
    direction: str  # up | down | flat


class ChangesOutput(_BaseOutput):
    narrative: str = Field(min_length=10)
    deltas: list[DeltaItem] = Field(default_factory=list)


class DeepDiveOutput(_BaseOutput):
    narrative: str = Field(min_length=10)
    highlights: list[str] = Field(default_factory=list)
    anomalies_list: list[AnomalyItem] = Field(default_factory=list)
    deltas: list[DeltaItem] = Field(default_factory=list)


# Map insight_type → schema class
SCHEMA_MAP: dict[str, type[_BaseOutput]] = {
    "summary": SummaryOutput,
    "anomalies": AnomalyOutput,
    "changes": ChangesOutput,
    "deep_dive": DeepDiveOutput,
}
