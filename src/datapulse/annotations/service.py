"""Annotations service — thin layer over AnnotationRepository."""

from __future__ import annotations

from datapulse.annotations.models import AnnotationCreate, AnnotationResponse
from datapulse.annotations.repository import AnnotationRepository


class AnnotationService:
    def __init__(self, repo: AnnotationRepository) -> None:
        self._repo = repo

    def list_by_chart(self, chart_id: str) -> list[AnnotationResponse]:
        rows = self._repo.list_by_chart(chart_id)
        return [AnnotationResponse(**r) for r in rows]

    def create(
        self,
        tenant_id: int,
        user_id: str,
        body: AnnotationCreate,
    ) -> AnnotationResponse:
        row = self._repo.create(
            tenant_id,
            user_id,
            body.chart_id,
            body.data_point,
            body.note,
            body.color,
        )
        return AnnotationResponse(**row)

    def delete(self, annotation_id: int, user_id: str) -> bool:
        return self._repo.delete(annotation_id, user_id)
