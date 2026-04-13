"""Pydantic models for the Control Center module.

All response models are frozen (immutable). Request models are mutable so
FastAPI can populate them from the request body.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ── Literals / enums ─────────────────────────────────────────

SourceType = Literal["file_upload", "google_sheets", "postgres", "mysql", "mssql", "shopify"]
SourceStatus = Literal["draft", "active", "error", "archived"]
RunMode = Literal["manual", "scheduled", "webhook", "watcher"]
DraftEntityType = Literal["source_connection", "pipeline_profile", "mapping_template", "bundle"]
DraftStatus = Literal[
    "draft",
    "validating",
    "validated",
    "previewing",
    "previewed",
    "publishing",
    "published",
    "invalidated",
    "preview_failed",
    "publish_failed",
]


# ── Canonical Domains (read-only catalogue) ──────────────────


class CanonicalDomain(BaseModel):
    """A semantic domain supported by DataPulse (e.g. sales_orders)."""

    model_config = ConfigDict(frozen=True)

    domain_key: str
    version: int
    display_name: str
    description: str
    json_schema: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


# ── Source Connections ───────────────────────────────────────


class SourceConnection(BaseModel):
    """Registered data source for a tenant."""

    model_config = ConfigDict(frozen=True)

    id: int
    tenant_id: int
    name: str
    source_type: SourceType
    status: SourceStatus
    config: dict[str, Any] = Field(default_factory=dict, alias="config_json")
    credentials_ref: str | None = None
    last_sync_at: datetime | None = None
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


# ── Pipeline Profiles ────────────────────────────────────────


class PipelineProfile(BaseModel):
    """Tenant-specific processing profile targeting a canonical domain."""

    model_config = ConfigDict(frozen=True)

    id: int
    tenant_id: int
    profile_key: str
    display_name: str
    target_domain: str
    is_default: bool
    config: dict[str, Any] = Field(default_factory=dict, alias="config_json")
    created_at: datetime
    updated_at: datetime


# ── Mapping Templates ────────────────────────────────────────


class MappingColumn(BaseModel):
    """One source→canonical column mapping row."""

    model_config = ConfigDict(frozen=True)

    source: str
    canonical: str
    cast: str | None = None  # e.g. "integer", "numeric", "date", "string"


class MappingTemplate(BaseModel):
    """Column-mapping template that transforms a source schema into canonical."""

    model_config = ConfigDict(frozen=True)

    id: int
    tenant_id: int
    source_type: SourceType
    template_name: str
    source_schema_hash: str | None = None
    mapping: dict[str, Any] = Field(default_factory=dict, alias="mapping_json")
    version: int
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


# ── Drafts & Releases ────────────────────────────────────────


class ValidationIssue(BaseModel):
    model_config = ConfigDict(frozen=True)
    code: str
    message: str
    field: str | None = None


class ValidationReport(BaseModel):
    model_config = ConfigDict(frozen=True)
    ok: bool
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)


class PipelineDraft(BaseModel):
    """In-progress edit bundle with state machine."""

    model_config = ConfigDict(frozen=True)

    id: int
    tenant_id: int
    entity_type: DraftEntityType
    entity_id: int | None = None
    draft: dict[str, Any] = Field(default_factory=dict, alias="draft_json")
    status: DraftStatus
    validation_report: dict[str, Any] | None = Field(default=None, alias="validation_report_json")
    preview_result: dict[str, Any] | None = Field(default=None, alias="preview_result_json")
    version: int
    created_by: str | None = None
    created_at: datetime
    updated_at: datetime


class PipelineRelease(BaseModel):
    """Immutable published snapshot."""

    model_config = ConfigDict(frozen=True)

    id: int
    tenant_id: int
    release_version: int
    draft_id: int | None = None
    source_release_id: int | None = None  # set when this release is a rollback
    snapshot: dict[str, Any] = Field(default_factory=dict, alias="snapshot_json")
    release_notes: str = ""
    is_rollback: bool = False
    published_by: str | None = None
    published_at: datetime


# ── Sync Jobs ────────────────────────────────────────────────


class SyncJob(BaseModel):
    """Links a source_connection + release to a pipeline_runs execution."""

    model_config = ConfigDict(frozen=True)

    id: int
    tenant_id: int
    pipeline_run_id: str | None = None  # UUID as string when present
    source_connection_id: int
    release_id: int | None = None
    profile_id: int | None = None
    run_mode: RunMode
    created_by: str | None = None
    created_at: datetime
    # Joined from pipeline_runs (populated by service.list_sync_history)
    status: str | None = None
    rows_loaded: int | None = None
    error_message: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_seconds: float | None = None


# ── Paginated response wrappers ──────────────────────────────


class SourceConnectionList(BaseModel):
    model_config = ConfigDict(frozen=True)
    items: list[SourceConnection]
    total: int


class PipelineProfileList(BaseModel):
    model_config = ConfigDict(frozen=True)
    items: list[PipelineProfile]
    total: int


class MappingTemplateList(BaseModel):
    model_config = ConfigDict(frozen=True)
    items: list[MappingTemplate]
    total: int


class PipelineReleaseList(BaseModel):
    model_config = ConfigDict(frozen=True)
    items: list[PipelineRelease]
    total: int


class SyncJobList(BaseModel):
    model_config = ConfigDict(frozen=True)
    items: list[SyncJob]
    total: int


class CanonicalDomainList(BaseModel):
    model_config = ConfigDict(frozen=True)
    items: list[CanonicalDomain]


# ── Request models (Phase 1b write operations) ───────────────


class CreateConnectionRequest(BaseModel):
    """Payload for POST /control-center/connections."""

    name: str = Field(..., min_length=1, max_length=200)
    source_type: SourceType
    config: dict[str, Any] = Field(default_factory=dict)


class UpdateConnectionRequest(BaseModel):
    """Payload for PATCH /control-center/connections/{id}.

    All fields are optional — only provided fields are updated.
    """

    name: str | None = Field(None, min_length=1, max_length=200)
    status: SourceStatus | None = None
    config: dict[str, Any] | None = None


# ── Connector result models ───────────────────────────────────


class ConnectionTestResult(BaseModel):
    """Result of POST /connections/{id}/test."""

    model_config = ConfigDict(frozen=True)

    ok: bool
    latency_ms: float | None = None
    error: str | None = None
    warnings: list[str] = Field(default_factory=list)


class PreviewColumn(BaseModel):
    """Metadata for one column in a preview result."""

    model_config = ConfigDict(frozen=True)

    source_name: str
    detected_type: str
    null_count: int = 0
    unique_count: int = 0
    sample_values: list[str] = Field(default_factory=list)


class ConnectionPreviewResult(BaseModel):
    """Result of POST /connections/{id}/preview."""

    model_config = ConfigDict(frozen=True)

    columns: list[PreviewColumn]
    sample_rows: list[dict[str, Any]] = Field(default_factory=list)
    row_count_estimate: int
    null_ratios: dict[str, float] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
