"""Report schedule API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request

from datapulse.api.auth import get_current_user
from datapulse.api.deps import get_schedule_service
from datapulse.api.limiter import limiter
from datapulse.reports.schedule_models import (
    ReportScheduleCreate,
    ReportScheduleResponse,
    ReportScheduleUpdate,
)
from datapulse.reports.schedule_service import ScheduleService

router = APIRouter(
    prefix="/report-schedules",
    tags=["report-schedules"],
    dependencies=[Depends(get_current_user)],
)

ServiceDep = Annotated[ScheduleService, Depends(get_schedule_service)]


@router.get("", response_model=list[ReportScheduleResponse])
@limiter.limit("30/minute")
def list_schedules(request: Request, service: ServiceDep) -> list[ReportScheduleResponse]:
    return service.list_schedules()


@router.post("", response_model=ReportScheduleResponse, status_code=201)
@limiter.limit("5/minute")
def create_schedule(
    request: Request, service: ServiceDep, body: ReportScheduleCreate
) -> ReportScheduleResponse:
    return service.create_schedule(body)


@router.patch("/{schedule_id}", response_model=ReportScheduleResponse)
@limiter.limit("5/minute")
def update_schedule(
    request: Request,
    service: ServiceDep,
    body: ReportScheduleUpdate,
    schedule_id: int = Path(),
) -> ReportScheduleResponse:
    result = service.update_schedule(schedule_id, body)
    if not result:
        raise HTTPException(404, "Schedule not found")
    return result


@router.delete("/{schedule_id}", status_code=204)
@limiter.limit("5/minute")
def delete_schedule(request: Request, service: ServiceDep, schedule_id: int = Path()) -> None:
    if not service.delete_schedule(schedule_id):
        raise HTTPException(404, "Schedule not found")
