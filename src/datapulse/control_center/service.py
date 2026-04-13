"""Service layer for the Control Center — orchestrates repositories.

Phase 1a: READ-only.
Phase 1b: Connection CRUD + test + preview added.
Draft / publish / rollback mutations land in Phase 1d.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from datapulse.control_center import canonical as canonical_helpers
from datapulse.control_center.models import (
    CanonicalDomain,
    CanonicalDomainList,
    ConnectionPreviewResult,
    ConnectionTestResult,
    MappingTemplate,
    MappingTemplateList,
    PipelineProfile,
    PipelineProfileList,
    PipelineRelease,
    PipelineReleaseList,
    SourceConnection,
    SourceConnectionList,
    SyncJob,
    SyncJobList,
)
from datapulse.control_center.repository import (
    MappingTemplateRepository,
    PipelineProfileRepository,
    PipelineReleaseRepository,
    SourceConnectionRepository,
    SyncJobRepository,
)
from datapulse.logging import get_logger

log = get_logger(__name__)


# ── Connector registry ────────────────────────────────────────
# Lazy-imported to avoid pulling in file I/O dependencies at import time.

def _get_connector(source_type: str):  # type: ignore[return]
    """Return the connector instance for a given source_type, or None."""
    if source_type == "file_upload":
        from datapulse.control_center.connectors.file_upload import FileUploadConnector
        return FileUploadConnector()
    return None


class ControlCenterService:
    """Unified service facade — one object routes to the relevant repo."""

    def __init__(
        self,
        session: Session,
        *,
        connections: SourceConnectionRepository,
        profiles: PipelineProfileRepository,
        mappings: MappingTemplateRepository,
        releases: PipelineReleaseRepository,
        sync_jobs: SyncJobRepository,
    ) -> None:
        self._session = session
        self._connections = connections
        self._profiles = profiles
        self._mappings = mappings
        self._releases = releases
        self._sync_jobs = sync_jobs

    # ── Canonical domains ────────────────────────────────────

    def list_canonical_domains(self) -> CanonicalDomainList:
        rows = canonical_helpers.list_canonical_domains(self._session)
        return CanonicalDomainList(items=[CanonicalDomain(**r) for r in rows])

    # ── Source connections ───────────────────────────────────

    def list_connections(
        self,
        *,
        source_type: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> SourceConnectionList:
        rows, total = self._connections.list(
            source_type=source_type, status=status, page=page, page_size=page_size
        )
        return SourceConnectionList(
            items=[SourceConnection(**r) for r in rows],
            total=total,
        )

    def get_connection(self, connection_id: int) -> SourceConnection | None:
        row = self._connections.get(connection_id)
        return SourceConnection(**row) if row else None

    # ── Connection writes (Phase 1b) ─────────────────────────

    def create_connection(
        self,
        *,
        tenant_id: int,
        name: str,
        source_type: str,
        config: dict,
        created_by: str | None = None,
    ) -> SourceConnection:
        """Create a new source connection for the current tenant."""
        row = self._connections.create(
            tenant_id=tenant_id,
            name=name,
            source_type=source_type,
            config_json=config,
            created_by=created_by,
        )
        return SourceConnection(**row)

    def update_connection(
        self,
        connection_id: int,
        *,
        name: str | None = None,
        status: str | None = None,
        config: dict | None = None,
    ) -> SourceConnection | None:
        """Update specified fields on an existing connection.

        Returns None when the connection is not found (or not accessible via RLS).
        """
        row = self._connections.update(
            connection_id,
            name=name,
            status=status,
            config_json=config,
        )
        return SourceConnection(**row) if row else None

    def archive_connection(self, connection_id: int) -> bool:
        """Set the connection status to 'archived'.

        Returns True if found, False if the id does not exist.
        """
        return self._connections.archive(connection_id)

    def test_connection(
        self,
        connection_id: int,
        *,
        tenant_id: int,
    ) -> ConnectionTestResult:
        """Run a connectivity test for the given source connection.

        Delegates to the appropriate SourceConnector.  Returns
        ``ok=False`` when the connection is not found or the source type
        has no connector registered yet.
        """
        conn = self.get_connection(connection_id)
        if conn is None:
            return ConnectionTestResult(ok=False, error="connection_not_found")

        connector = _get_connector(conn.source_type)
        if connector is None:
            return ConnectionTestResult(
                ok=False,
                error=f"test_not_supported_for_source_type:{conn.source_type}",
            )
        return connector.test(tenant_id=tenant_id, config=conn.config)

    def preview_connection(
        self,
        *,
        connection_id: int,
        tenant_id: int,
        max_rows: int = 1000,
        sample_rows: int = 50,
    ) -> ConnectionPreviewResult:
        """Return a read-only data sample for the given source connection.

        Raises:
            ValueError:        When the connection does not exist, or the
                               source type does not support preview.
            FileNotFoundError: When the underlying file is no longer available.
        """
        from datapulse.control_center import preview as preview_engine  # isolated module

        conn = self.get_connection(connection_id)
        if conn is None:
            raise ValueError("connection_not_found")

        if conn.source_type == "file_upload":
            return preview_engine.preview_file_upload(
                tenant_id,
                conn.config,
                max_rows=max_rows,
                sample_rows=sample_rows,
            )
        raise ValueError(f"preview_not_supported_for:{conn.source_type}")

    # ── Pipeline profiles ────────────────────────────────────

    def list_profiles(
        self,
        *,
        target_domain: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> PipelineProfileList:
        rows, total = self._profiles.list(
            target_domain=target_domain, page=page, page_size=page_size
        )
        return PipelineProfileList(
            items=[PipelineProfile(**r) for r in rows],
            total=total,
        )

    def get_profile(self, profile_id: int) -> PipelineProfile | None:
        row = self._profiles.get(profile_id)
        return PipelineProfile(**row) if row else None

    # ── Mapping templates ────────────────────────────────────

    def list_mappings(
        self,
        *,
        source_type: str | None = None,
        template_name: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> MappingTemplateList:
        rows, total = self._mappings.list(
            source_type=source_type,
            template_name=template_name,
            page=page,
            page_size=page_size,
        )
        return MappingTemplateList(
            items=[MappingTemplate(**r) for r in rows],
            total=total,
        )

    def get_mapping(self, template_id: int) -> MappingTemplate | None:
        row = self._mappings.get(template_id)
        return MappingTemplate(**row) if row else None

    # ── Releases ─────────────────────────────────────────────

    def list_releases(
        self,
        *,
        page: int = 1,
        page_size: int = 50,
    ) -> PipelineReleaseList:
        rows, total = self._releases.list(page=page, page_size=page_size)
        return PipelineReleaseList(
            items=[PipelineRelease(**r) for r in rows],
            total=total,
        )

    def get_release(self, release_id: int) -> PipelineRelease | None:
        row = self._releases.get(release_id)
        return PipelineRelease(**row) if row else None

    # ── Sync history ─────────────────────────────────────────

    def list_sync_history(
        self,
        *,
        connection_id: int,
        page: int = 1,
        page_size: int = 50,
    ) -> SyncJobList:
        rows, total = self._sync_jobs.list_for_connection(
            connection_id, page=page, page_size=page_size
        )
        return SyncJobList(
            items=[SyncJob(**r) for r in rows],
            total=total,
        )
