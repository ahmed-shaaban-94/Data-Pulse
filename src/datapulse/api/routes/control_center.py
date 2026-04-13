"""Control Center API — unified data control plane.

Phase 1a: READ-only endpoints.
Phase 1b: Connection CRUD + test + preview (file_upload sources).
Writes (drafts, publish, rollback, sync) land in Phase 1c–1e.

All endpoints are gated by:
  - Auth: Auth0 / API key via get_current_user
  - Tenant scope: get_tenant_session sets app.tenant_id for RLS
  - RBAC: require_permission("control_center:*")
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy.orm import Session

from datapulse.api.auth import get_current_user
from datapulse.api.deps import get_tenant_session
from datapulse.api.limiter import limiter
from datapulse.control_center.models import (
    CanonicalDomainList,
    ConnectionPreviewResult,
    ConnectionTestResult,
    CreateConnectionRequest,
    MappingTemplate,
    MappingTemplateList,
    PipelineProfile,
    PipelineProfileList,
    PipelineRelease,
    PipelineReleaseList,
    SourceConnection,
    SourceConnectionList,
    SyncJobList,
    UpdateConnectionRequest,
)
from datapulse.control_center.repository import (
    MappingTemplateRepository,
    PipelineProfileRepository,
    PipelineReleaseRepository,
    SourceConnectionRepository,
    SyncJobRepository,
)
from datapulse.control_center.service import ControlCenterService
from datapulse.rbac.dependencies import require_permission

UserDep = Annotated[dict[str, Any], Depends(get_current_user)]

router = APIRouter(
    prefix="/control-center",
    tags=["control-center"],
    dependencies=[Depends(get_current_user)],
)


# ------------------------------------------------------------------
# Dependency injection — local factory (follows onboarding pattern)
# ------------------------------------------------------------------


def get_control_center_service(
    session: Annotated[Session, Depends(get_tenant_session)],
) -> ControlCenterService:
    return ControlCenterService(
        session,
        connections=SourceConnectionRepository(session),
        profiles=PipelineProfileRepository(session),
        mappings=MappingTemplateRepository(session),
        releases=PipelineReleaseRepository(session),
        sync_jobs=SyncJobRepository(session),
    )


ServiceDep = Annotated[ControlCenterService, Depends(get_control_center_service)]


# ------------------------------------------------------------------
# Canonical domains — public read (all authenticated users)
# ------------------------------------------------------------------


@router.get("/canonical-domains", response_model=CanonicalDomainList)
@limiter.limit("60/minute")
def list_canonical_domains(
    request: Request,
    service: ServiceDep,
) -> CanonicalDomainList:
    """List all active canonical semantic domains."""
    return service.list_canonical_domains()


# ------------------------------------------------------------------
# Source connections — view
# ------------------------------------------------------------------


@router.get(
    "/connections",
    response_model=SourceConnectionList,
    dependencies=[Depends(require_permission("control_center:connections:view"))],
)
@limiter.limit("60/minute")
def list_connections(
    request: Request,
    service: ServiceDep,
    source_type: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> SourceConnectionList:
    """List registered data sources for the current tenant."""
    return service.list_connections(
        source_type=source_type, status=status, page=page, page_size=page_size
    )


@router.get(
    "/connections/{connection_id}",
    response_model=SourceConnection,
    dependencies=[Depends(require_permission("control_center:connections:view"))],
)
@limiter.limit("60/minute")
def get_connection(
    request: Request,
    service: ServiceDep,
    connection_id: Annotated[int, Path(ge=1)],
) -> SourceConnection:
    """Fetch one source connection by id."""
    conn = service.get_connection(connection_id)
    if conn is None:
        raise HTTPException(status_code=404, detail="connection_not_found")
    return conn


# ------------------------------------------------------------------
# Source connections — write (Phase 1b)
# ------------------------------------------------------------------


@router.post(
    "/connections",
    response_model=SourceConnection,
    status_code=201,
    dependencies=[Depends(require_permission("control_center:connections:manage"))],
)
@limiter.limit("30/minute")
def create_connection(
    request: Request,
    service: ServiceDep,
    body: CreateConnectionRequest,
    user: UserDep,
) -> SourceConnection:
    """Register a new source connection for the current tenant.

    Phase 1b supports ``source_type=file_upload`` only.  The ``config``
    object must include ``file_id`` (UUID from /upload/files) and
    ``filename`` (original file name including extension).
    """
    tenant_id = int(user.get("tenant_id", 1))
    created_by: str = user.get("sub", user.get("user_id", "anonymous"))
    return service.create_connection(
        tenant_id=tenant_id,
        name=body.name,
        source_type=body.source_type,
        config=body.config,
        created_by=created_by,
    )


@router.patch(
    "/connections/{connection_id}",
    response_model=SourceConnection,
    dependencies=[Depends(require_permission("control_center:connections:manage"))],
)
@limiter.limit("30/minute")
def update_connection(
    request: Request,
    service: ServiceDep,
    connection_id: Annotated[int, Path(ge=1)],
    body: UpdateConnectionRequest,
) -> SourceConnection:
    """Update one or more fields on an existing source connection.

    Only the fields present in the request body are updated (partial update).
    """
    conn = service.update_connection(
        connection_id,
        name=body.name,
        status=body.status,
        config=body.config,
    )
    if conn is None:
        raise HTTPException(status_code=404, detail="connection_not_found")
    return conn


@router.delete(
    "/connections/{connection_id}",
    status_code=204,
    dependencies=[Depends(require_permission("control_center:connections:manage"))],
)
@limiter.limit("30/minute")
def archive_connection(
    request: Request,
    service: ServiceDep,
    connection_id: Annotated[int, Path(ge=1)],
) -> None:
    """Archive a source connection (sets status to 'archived').

    The row is retained for audit purposes. Use PATCH to restore it.
    """
    found = service.archive_connection(connection_id)
    if not found:
        raise HTTPException(status_code=404, detail="connection_not_found")


@router.post(
    "/connections/{connection_id}/test",
    response_model=ConnectionTestResult,
    dependencies=[Depends(require_permission("control_center:connections:manage"))],
)
@limiter.limit("20/minute")
def test_connection(
    request: Request,
    service: ServiceDep,
    user: UserDep,
    connection_id: Annotated[int, Path(ge=1)],
) -> ConnectionTestResult:
    """Verify that the source connection is reachable.

    For ``file_upload`` sources, this checks whether the uploaded file
    is still present in the temp directory.
    """
    if service.get_connection(connection_id) is None:
        raise HTTPException(status_code=404, detail="connection_not_found")
    tenant_id = int(user.get("tenant_id", 1))
    return service.test_connection(connection_id, tenant_id=tenant_id)


@router.post(
    "/connections/{connection_id}/preview",
    response_model=ConnectionPreviewResult,
    dependencies=[Depends(require_permission("control_center:pipeline:preview"))],
)
@limiter.limit("10/minute")
def preview_connection(
    request: Request,
    service: ServiceDep,
    user: UserDep,
    connection_id: Annotated[int, Path(ge=1)],
    max_rows: Annotated[int, Query(ge=1, le=10_000)] = 1000,
    sample_rows: Annotated[int, Query(ge=1, le=200)] = 50,
) -> ConnectionPreviewResult:
    """Return a read-only data sample for the source connection.

    Reads the uploaded file directly — never writes to bronze.
    ``max_rows`` caps total rows read; ``sample_rows`` caps rows in the response.
    """
    if service.get_connection(connection_id) is None:
        raise HTTPException(status_code=404, detail="connection_not_found")
    tenant_id = int(user.get("tenant_id", 1))
    try:
        return service.preview_connection(
            connection_id=connection_id,
            tenant_id=tenant_id,
            max_rows=max_rows,
            sample_rows=sample_rows,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ------------------------------------------------------------------
# Pipeline profiles — view
# ------------------------------------------------------------------


@router.get(
    "/profiles",
    response_model=PipelineProfileList,
    dependencies=[Depends(require_permission("control_center:profiles:view"))],
)
@limiter.limit("60/minute")
def list_profiles(
    request: Request,
    service: ServiceDep,
    target_domain: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> PipelineProfileList:
    """List pipeline profiles for the current tenant."""
    return service.list_profiles(
        target_domain=target_domain, page=page, page_size=page_size
    )


@router.get(
    "/profiles/{profile_id}",
    response_model=PipelineProfile,
    dependencies=[Depends(require_permission("control_center:profiles:view"))],
)
@limiter.limit("60/minute")
def get_profile(
    request: Request,
    service: ServiceDep,
    profile_id: Annotated[int, Path(ge=1)],
) -> PipelineProfile:
    """Fetch one pipeline profile by id."""
    profile = service.get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="profile_not_found")
    return profile


# ------------------------------------------------------------------
# Mapping templates — editor+ (view via mappings:manage; tighter than others
# because mappings reveal column-level business logic)
# ------------------------------------------------------------------


@router.get(
    "/mappings",
    response_model=MappingTemplateList,
    dependencies=[Depends(require_permission("control_center:mappings:manage"))],
)
@limiter.limit("60/minute")
def list_mappings(
    request: Request,
    service: ServiceDep,
    source_type: Annotated[str | None, Query()] = None,
    template_name: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> MappingTemplateList:
    """List mapping templates for the current tenant."""
    return service.list_mappings(
        source_type=source_type,
        template_name=template_name,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/mappings/{template_id}",
    response_model=MappingTemplate,
    dependencies=[Depends(require_permission("control_center:mappings:manage"))],
)
@limiter.limit("60/minute")
def get_mapping(
    request: Request,
    service: ServiceDep,
    template_id: Annotated[int, Path(ge=1)],
) -> MappingTemplate:
    """Fetch one mapping template by id."""
    tpl = service.get_mapping(template_id)
    if tpl is None:
        raise HTTPException(status_code=404, detail="mapping_template_not_found")
    return tpl


# ------------------------------------------------------------------
# Releases — view (admin only; uses profiles:view as the baseline guard
# since releases contain config snapshots)
# ------------------------------------------------------------------


@router.get(
    "/releases",
    response_model=PipelineReleaseList,
    dependencies=[Depends(require_permission("control_center:profiles:view"))],
)
@limiter.limit("60/minute")
def list_releases(
    request: Request,
    service: ServiceDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> PipelineReleaseList:
    """List published releases (append-only, newest first)."""
    return service.list_releases(page=page, page_size=page_size)


@router.get(
    "/releases/{release_id}",
    response_model=PipelineRelease,
    dependencies=[Depends(require_permission("control_center:profiles:view"))],
)
@limiter.limit("60/minute")
def get_release(
    request: Request,
    service: ServiceDep,
    release_id: Annotated[int, Path(ge=1)],
) -> PipelineRelease:
    """Fetch one release by id — includes full snapshot_json."""
    rel = service.get_release(release_id)
    if rel is None:
        raise HTTPException(status_code=404, detail="release_not_found")
    return rel


# ------------------------------------------------------------------
# Sync history — view (connection-scoped)
# ------------------------------------------------------------------


@router.get(
    "/connections/{connection_id}/sync-history",
    response_model=SyncJobList,
    dependencies=[Depends(require_permission("control_center:connections:view"))],
)
@limiter.limit("60/minute")
def list_sync_history(
    request: Request,
    service: ServiceDep,
    connection_id: Annotated[int, Path(ge=1)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> SyncJobList:
    """List past sync jobs for a source connection (joined with pipeline_runs)."""
    # Verify connection exists & is tenant-visible (RLS enforces scope)
    if service.get_connection(connection_id) is None:
        raise HTTPException(status_code=404, detail="connection_not_found")
    return service.list_sync_history(
        connection_id=connection_id, page=page, page_size=page_size
    )
