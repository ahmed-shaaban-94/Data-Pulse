"""Repository layer for the Control Center.

All queries use SQLAlchemy text() with parameterized placeholders. RLS is
enforced by the caller's tenant-scoped session (SET LOCAL app.tenant_id).

Phase 1a: READ methods only.
Phase 1b: WRITE methods added to SourceConnectionRepository.
"""

from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.orm import Session

from datapulse.logging import get_logger

log = get_logger(__name__)


class SourceConnectionRepository:
    """Data access for source_connections."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list(
        self,
        *,
        source_type: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        conditions: list[str] = []
        params: dict = {}
        if source_type:
            conditions.append("source_type = :source_type")
            params["source_type"] = source_type
        if status:
            conditions.append("status = :status")
            params["status"] = status

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        count_sql = text(f"SELECT COUNT(*) FROM public.source_connections {where}")  # noqa: S608
        total = self._session.execute(count_sql, params).scalar() or 0

        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        sql = text(f"""
            SELECT id, tenant_id, name, source_type, status, config_json,
                   credentials_ref, last_sync_at, created_by, created_at, updated_at
            FROM public.source_connections
            {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)  # noqa: S608
        rows = self._session.execute(sql, params).mappings().all()
        return [dict(r) for r in rows], total

    def get(self, connection_id: int) -> dict | None:
        stmt = text("""
            SELECT id, tenant_id, name, source_type, status, config_json,
                   credentials_ref, last_sync_at, created_by, created_at, updated_at
            FROM public.source_connections
            WHERE id = :id
        """)
        row = self._session.execute(stmt, {"id": connection_id}).mappings().fetchone()
        return dict(row) if row else None

    # ── Write operations (Phase 1b) ──────────────────────────

    def create(
        self,
        *,
        tenant_id: int,
        name: str,
        source_type: str,
        config_json: dict,
        created_by: str | None = None,
    ) -> dict:
        """Insert a new source connection and return the inserted row."""
        stmt = text("""
            INSERT INTO public.source_connections
                (tenant_id, name, source_type, config_json, created_by)
            VALUES
                (:tenant_id, :name, :source_type, :config_json::jsonb, :created_by)
            RETURNING id, tenant_id, name, source_type, status, config_json,
                      credentials_ref, last_sync_at, created_by, created_at, updated_at
        """)
        row = (
            self._session.execute(
                stmt,
                {
                    "tenant_id": tenant_id,
                    "name": name,
                    "source_type": source_type,
                    "config_json": json.dumps(config_json),
                    "created_by": created_by,
                },
            )
            .mappings()
            .fetchone()
        )
        if row is None:
            raise RuntimeError("INSERT RETURNING unexpectedly returned no row")
        log.info(
            "source_connection_created",
            tenant_id=tenant_id,
            name=name,
            source_type=source_type,
        )
        return dict(row)

    def update(
        self,
        connection_id: int,
        *,
        name: str | None = None,
        status: str | None = None,
        config_json: dict | None = None,
    ) -> dict | None:
        """Update specified fields. Returns the updated row or None if not found."""
        sets: list[str] = []
        params: dict = {"id": connection_id}
        if name is not None:
            sets.append("name = :name")
            params["name"] = name
        if status is not None:
            sets.append("status = :status")
            params["status"] = status
        if config_json is not None:
            sets.append("config_json = :config_json::jsonb")
            params["config_json"] = json.dumps(config_json)
        if not sets:
            # Nothing to update — return current state
            return self.get(connection_id)
        sets.append("updated_at = now()")
        stmt = text(f"""
            UPDATE public.source_connections
            SET {', '.join(sets)}
            WHERE id = :id
            RETURNING id, tenant_id, name, source_type, status, config_json,
                      credentials_ref, last_sync_at, created_by, created_at, updated_at
        """)  # noqa: S608
        row = self._session.execute(stmt, params).mappings().fetchone()
        return dict(row) if row else None

    def archive(self, connection_id: int) -> bool:
        """Set status to 'archived'. Returns True if a row was updated."""
        stmt = text("""
            UPDATE public.source_connections
            SET status = 'archived', updated_at = now()
            WHERE id = :id AND status != 'archived'
            RETURNING id
        """)
        row = self._session.execute(stmt, {"id": connection_id}).fetchone()
        return row is not None


class PipelineProfileRepository:
    """Data access for pipeline_profiles."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list(
        self,
        *,
        target_domain: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        conditions: list[str] = []
        params: dict = {}
        if target_domain:
            conditions.append("target_domain = :target_domain")
            params["target_domain"] = target_domain

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        count_sql = text(f"SELECT COUNT(*) FROM public.pipeline_profiles {where}")  # noqa: S608
        total = self._session.execute(count_sql, params).scalar() or 0

        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        sql = text(f"""
            SELECT id, tenant_id, profile_key, display_name, target_domain,
                   is_default, config_json, created_at, updated_at
            FROM public.pipeline_profiles
            {where}
            ORDER BY is_default DESC, profile_key
            LIMIT :limit OFFSET :offset
        """)  # noqa: S608
        rows = self._session.execute(sql, params).mappings().all()
        return [dict(r) for r in rows], total

    def get(self, profile_id: int) -> dict | None:
        stmt = text("""
            SELECT id, tenant_id, profile_key, display_name, target_domain,
                   is_default, config_json, created_at, updated_at
            FROM public.pipeline_profiles
            WHERE id = :id
        """)
        row = self._session.execute(stmt, {"id": profile_id}).mappings().fetchone()
        return dict(row) if row else None


class MappingTemplateRepository:
    """Data access for mapping_templates."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list(
        self,
        *,
        source_type: str | None = None,
        template_name: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        conditions: list[str] = []
        params: dict = {}
        if source_type:
            conditions.append("source_type = :source_type")
            params["source_type"] = source_type
        if template_name:
            conditions.append("template_name ILIKE :template_name")
            params["template_name"] = f"%{template_name}%"

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        count_sql = text(f"SELECT COUNT(*) FROM public.mapping_templates {where}")  # noqa: S608
        total = self._session.execute(count_sql, params).scalar() or 0

        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        sql = text(f"""
            SELECT id, tenant_id, source_type, template_name, source_schema_hash,
                   mapping_json, version, created_by, created_at, updated_at
            FROM public.mapping_templates
            {where}
            ORDER BY template_name, version DESC
            LIMIT :limit OFFSET :offset
        """)  # noqa: S608
        rows = self._session.execute(sql, params).mappings().all()
        return [dict(r) for r in rows], total

    def get(self, template_id: int) -> dict | None:
        stmt = text("""
            SELECT id, tenant_id, source_type, template_name, source_schema_hash,
                   mapping_json, version, created_by, created_at, updated_at
            FROM public.mapping_templates
            WHERE id = :id
        """)
        row = self._session.execute(stmt, {"id": template_id}).mappings().fetchone()
        return dict(row) if row else None


class PipelineReleaseRepository:
    """Data access for pipeline_releases (append-only, read-only here)."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list(
        self,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        count_sql = text("SELECT COUNT(*) FROM public.pipeline_releases")
        total = self._session.execute(count_sql).scalar() or 0
        sql = text("""
            SELECT id, tenant_id, release_version, draft_id, source_release_id,
                   snapshot_json, release_notes, is_rollback, published_by, published_at
            FROM public.pipeline_releases
            ORDER BY release_version DESC
            LIMIT :limit OFFSET :offset
        """)
        rows = self._session.execute(
            sql, {"limit": page_size, "offset": (page - 1) * page_size}
        ).mappings().all()
        return [dict(r) for r in rows], total

    def get(self, release_id: int) -> dict | None:
        stmt = text("""
            SELECT id, tenant_id, release_version, draft_id, source_release_id,
                   snapshot_json, release_notes, is_rollback, published_by, published_at
            FROM public.pipeline_releases
            WHERE id = :id
        """)
        row = self._session.execute(stmt, {"id": release_id}).mappings().fetchone()
        return dict(row) if row else None

    def latest(self) -> dict | None:
        """Most recent release for the current tenant (RLS-scoped)."""
        stmt = text("""
            SELECT id, tenant_id, release_version, draft_id, source_release_id,
                   snapshot_json, release_notes, is_rollback, published_by, published_at
            FROM public.pipeline_releases
            ORDER BY release_version DESC
            LIMIT 1
        """)
        row = self._session.execute(stmt).mappings().fetchone()
        return dict(row) if row else None


class SyncJobRepository:
    """Data access for sync_jobs — always JOIN with pipeline_runs for status."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def list_for_connection(
        self,
        connection_id: int,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[dict], int]:
        count_sql = text("""
            SELECT COUNT(*)
            FROM public.sync_jobs
            WHERE source_connection_id = :cid
        """)
        total = self._session.execute(count_sql, {"cid": connection_id}).scalar() or 0

        sql = text("""
            SELECT sj.id, sj.tenant_id, sj.pipeline_run_id::text AS pipeline_run_id,
                   sj.source_connection_id, sj.release_id, sj.profile_id,
                   sj.run_mode, sj.created_by, sj.created_at,
                   pr.status, pr.rows_loaded, pr.error_message,
                   pr.started_at, pr.finished_at, pr.duration_seconds
            FROM public.sync_jobs sj
            LEFT JOIN public.pipeline_runs pr ON pr.id = sj.pipeline_run_id
            WHERE sj.source_connection_id = :cid
            ORDER BY sj.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        rows = self._session.execute(
            sql,
            {"cid": connection_id, "limit": page_size, "offset": (page - 1) * page_size},
        ).mappings().all()
        return [dict(r) for r in rows], total
