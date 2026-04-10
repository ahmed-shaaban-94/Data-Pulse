"""Report schedule service — thin layer over ScheduleRepository."""

from __future__ import annotations

from datapulse.reports.schedule_models import (
    ReportScheduleCreate,
    ReportScheduleResponse,
    ReportScheduleUpdate,
)
from datapulse.reports.schedule_repository import ScheduleRepository


class ScheduleService:
    def __init__(self, repo: ScheduleRepository) -> None:
        self._repo = repo

    def list_schedules(self) -> list[ReportScheduleResponse]:
        return self._repo.list_schedules()

    def create_schedule(self, body: ReportScheduleCreate) -> ReportScheduleResponse:
        return self._repo.create_schedule(body)

    def update_schedule(
        self, schedule_id: int, body: ReportScheduleUpdate
    ) -> ReportScheduleResponse | None:
        return self._repo.update_schedule(schedule_id, body)

    def delete_schedule(self, schedule_id: int) -> bool:
        return self._repo.delete_schedule(schedule_id)
