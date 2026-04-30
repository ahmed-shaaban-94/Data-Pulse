"""Admin write-side models for staged POS desktop release rollouts.

Read-side equivalents (and the broader release/policy models) live in
``updates.py``. Splitting keeps the operator write surface
(RBAC-gated `pos:update:manage`) clearly separated from the cashier-facing
read surface, and lets the workflow's ``curl ... /admin/desktop-releases``
call use a small, stable contract.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ChannelLiteral = Literal["stable", "beta"]
PlatformLiteral = Literal["win32", "darwin", "linux"]
RolloutScopeLiteral = Literal["all", "selected", "paused"]


class DesktopReleaseCreate(BaseModel):
    """Body of POST /api/v1/pos/admin/desktop-releases.

    Idempotent on (version, channel, platform) at the service layer.
    """

    model_config = ConfigDict(frozen=True)

    version: str = Field(..., min_length=1, max_length=50)
    channel: ChannelLiteral = "stable"
    platform: PlatformLiteral = "win32"
    rollout_scope: RolloutScopeLiteral = "all"
    active: bool = True
    release_notes: str | None = Field(default=None, max_length=4000)
    min_app_version: str | None = Field(default=None, max_length=50)
    min_schema_version: int | None = Field(default=None, ge=1)
    max_schema_version: int | None = Field(default=None, ge=1)

    @field_validator("version")
    @classmethod
    def _strip_v_prefix(cls, v: str) -> str:
        # Allow callers to send "v2.0.0" or "2.0.0"; we always store without prefix.
        stripped = v.lstrip("v").strip()
        if not stripped:
            raise ValueError("version must not be empty after stripping leading 'v'")
        return stripped


class DesktopReleaseResponse(BaseModel):
    """Echo of the inserted/updated row, including DB-assigned columns."""

    model_config = ConfigDict(frozen=True)

    release_id: int
    version: str
    channel: ChannelLiteral
    platform: PlatformLiteral
    rollout_scope: RolloutScopeLiteral
    active: bool
    release_notes: str | None = None
    min_app_version: str | None = None
    min_schema_version: int | None = None
    max_schema_version: int | None = None
    created_at: datetime
    updated_at: datetime
