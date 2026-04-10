"""Search service — thin layer over SearchRepository."""

from __future__ import annotations

from datapulse.analytics.search_repository import SearchRepository


class SearchService:
    def __init__(self, repo: SearchRepository) -> None:
        self._repo = repo

    def search(self, query: str, limit: int = 10) -> dict:
        return self._repo.search(query, limit)
