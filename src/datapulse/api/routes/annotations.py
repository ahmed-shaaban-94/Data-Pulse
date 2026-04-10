"""Chart annotations API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from datapulse.annotations.models import AnnotationCreate, AnnotationResponse
from datapulse.annotations.service import AnnotationService
from datapulse.api.auth import get_current_user
from datapulse.api.deps import CurrentUser, get_annotation_service
from datapulse.api.limiter import limiter

router = APIRouter(
    prefix="/annotations",
    tags=["annotations"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[AnnotationService, Depends(get_annotation_service)]


@router.get("", response_model=list[AnnotationResponse])
@limiter.limit("30/minute")
def list_annotations(
    request: Request,
    service: ServiceDep,
    chart_id: str = Query(...),
) -> list[AnnotationResponse]:
    return service.list_by_chart(chart_id)


@router.post("", response_model=AnnotationResponse, status_code=201)
@limiter.limit("10/minute")
def create_annotation(
    request: Request,
    service: ServiceDep,
    user: CurrentUser,
    body: AnnotationCreate,
) -> AnnotationResponse:
    return service.create(int(user.get("tenant_id", "1")), user["sub"], body)


@router.delete("/{annotation_id}", status_code=204)
@limiter.limit("10/minute")
def delete_annotation(
    request: Request,
    service: ServiceDep,
    user: CurrentUser,
    annotation_id: int = Path(),
) -> None:
    deleted = service.delete(annotation_id, user["sub"])
    if not deleted:
        raise HTTPException(404, "Annotation not found")
