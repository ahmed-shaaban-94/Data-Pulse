"""Pydantic schemas for LLM output validation in the AI Light graph.

Each schema corresponds to one insight_type. The ``validate`` node
instantiates the appropriate schema against ``llm_parsed_output``; if
Pydantic raises, validation_retries increments and the graph loops back
to ``analyze``. After 2 retries the ``fallback`` node is taken instead.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SummaryOutput(BaseModel):
    """Expected JSON structure returned by the LLM for insight_type=summary."""

    narrative: str = Field(description="Executive narrative paragraph (3-5 sentences)")
    highlights: list[str] = Field(
        default_factory=list,
        description="Bullet-point highlights (3-5 items)",
    )


class AnomalyItem(BaseModel):
    """A single anomaly returned by the LLM."""

    date: str = Field(description="ISO date string YYYY-MM-DD")
    description: str = Field(description="What was unusual about this date")
    severity: str = Field(description="Severity level: low | medium | high")


class AnomalyOutput(BaseModel):
    """Expected JSON structure for insight_type=anomalies."""

    anomalies: list[AnomalyItem] = Field(
        default_factory=list,
        description="List of detected anomalies (empty if none found)",
    )
    narrative: str = Field(
        default="",
        description="Overall anomaly summary paragraph",
    )


class ChangesOutput(BaseModel):
    """Expected JSON structure for insight_type=changes."""

    narrative: str = Field(description="Change explanation narrative (3-4 sentences)")
    key_changes: list[str] = Field(
        default_factory=list,
        description="Bullet-point key changes",
    )


# Registry: maps insight_type string → schema class
SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "summary": SummaryOutput,
    "anomalies": AnomalyOutput,
    "changes": ChangesOutput,
}
