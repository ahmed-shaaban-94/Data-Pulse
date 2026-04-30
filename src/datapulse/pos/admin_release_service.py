"""Idempotent upsert into ``pos.desktop_update_releases``.

Operator-write surface for the staged desktop-update rollouts table.
Replaces the per-release SQL migration pattern (#802 used migration 123)
by giving the release workflow a stable HTTP entry point that is safe
to call repeatedly with the same payload.

The rollout-target tenants table (``pos.desktop_update_release_targets``)
is *not* touched here — every workflow-driven call uses
``rollout_scope='all'``. The legacy operator endpoint at
``POST /api/v1/pos/updates/releases`` retains the targets-write path
for the ``selected`` rollout-scope flow.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.pos.models.admin_release import (
    DesktopReleaseCreate,
    DesktopReleaseResponse,
)


def upsert_release(
    session: Session,
    payload: DesktopReleaseCreate,
) -> DesktopReleaseResponse:
    """Insert-or-update a row in ``pos.desktop_update_releases``.

    Idempotent on ``(version, channel, platform)``. Re-calls update
    ``active``, ``rollout_scope``, ``release_notes``, ``min_app_version``,
    ``min_schema_version``, and ``max_schema_version`` on the existing
    row without creating a duplicate.
    """
    row = (
        session.execute(
            text(
                """
                INSERT INTO pos.desktop_update_releases (
                    version,
                    channel,
                    platform,
                    rollout_scope,
                    active,
                    release_notes,
                    min_app_version,
                    min_schema_version,
                    max_schema_version
                )
                VALUES (
                    :version,
                    :channel,
                    :platform,
                    :rollout_scope,
                    :active,
                    :release_notes,
                    :min_app_version,
                    :min_schema_version,
                    :max_schema_version
                )
                ON CONFLICT (version, channel, platform) DO UPDATE SET
                    rollout_scope      = EXCLUDED.rollout_scope,
                    active             = EXCLUDED.active,
                    release_notes      = EXCLUDED.release_notes,
                    min_app_version    = EXCLUDED.min_app_version,
                    min_schema_version = EXCLUDED.min_schema_version,
                    max_schema_version = EXCLUDED.max_schema_version,
                    updated_at         = now()
                RETURNING release_id, version, channel, platform, rollout_scope,
                          active, release_notes, min_app_version,
                          min_schema_version, max_schema_version,
                          created_at, updated_at
                """
            ),
            {
                "version": payload.version,
                "channel": payload.channel,
                "platform": payload.platform,
                "rollout_scope": payload.rollout_scope,
                "active": payload.active,
                "release_notes": payload.release_notes,
                "min_app_version": payload.min_app_version,
                "min_schema_version": payload.min_schema_version,
                "max_schema_version": payload.max_schema_version,
            },
        )
        .mappings()
        .one()
    )
    session.commit()
    return DesktopReleaseResponse.model_validate(dict(row))
