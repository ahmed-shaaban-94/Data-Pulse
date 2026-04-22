"""POS product/stock lookup and catalog sync routes.

Sub-router for ``pos.py`` facade (issue #543).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request

from datapulse.api.deps import get_pos_service
from datapulse.api.limiter import limiter
from datapulse.api.routes._pos_routes_deps import (
    CurrentUser,
    ServiceDep,
)
from datapulse.billing.pos_guard import require_pos_plan
from datapulse.pos.models import (
    CatalogProductPage,
    CatalogStockPage,
    PosProductResult,
    PosStockInfo,
)
from datapulse.pos.service import PosService

router = APIRouter()


@router.get("/products/search", response_model=list[PosProductResult])
@limiter.limit("60/minute")
def search_products(
    request: Request,
    service: ServiceDep,
    user: CurrentUser,
    q: Annotated[str, Query(min_length=1, max_length=100, alias="q")],
    site_code: Annotated[str | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[PosProductResult]:
    """Search the product catalog by drug code, name, or brand."""
    _ = user
    return service.search_products(q, site_code=site_code, limit=limit)


@router.get(
    "/products/{drug_code}/stock",
    response_model=PosStockInfo,
)
@limiter.limit("60/minute")
async def get_stock_info(
    request: Request,
    drug_code: Annotated[str, Path(min_length=1, max_length=100)],
    service: ServiceDep,
    user: CurrentUser,
    site_code: Annotated[str, Query(min_length=1, max_length=50)],
) -> PosStockInfo:
    """Return live stock + per-batch info for a drug at a site."""
    _ = user
    return await service.get_stock_info(drug_code, site_code)


@router.get(
    "/catalog/products",
    response_model=CatalogProductPage,
    summary="Paginated product catalog for offline sync",
)
@limiter.limit("30/minute")
def get_catalog_products(
    request: Request,
    user: CurrentUser,
    _: Annotated[None, Depends(require_pos_plan())],
    service: Annotated[PosService, Depends(get_pos_service)],
    cursor: Annotated[str | None, Query(description="Last drug_code from previous page")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> CatalogProductPage:
    """Return a page of products ordered by ``drug_code``.

    Pass the returned ``next_cursor`` on subsequent requests to page forward.
    When ``next_cursor`` is null the catalog is exhausted; reset to
    ``cursor=null`` on the next sync cycle.
    """
    return service.get_catalog_products(cursor=cursor, limit=limit)


@router.get(
    "/catalog/stock",
    response_model=CatalogStockPage,
    summary="Paginated active-batch stock for offline sync",
)
@limiter.limit("30/minute")
def get_catalog_stock(
    request: Request,
    user: CurrentUser,
    _: Annotated[None, Depends(require_pos_plan())],
    service: Annotated[PosService, Depends(get_pos_service)],
    site: Annotated[str | None, Query(description="Filter to a specific site_code")] = None,
    cursor: Annotated[str | None, Query(description="Last loaded_at ISO (cursor)")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> CatalogStockPage:
    """Return a page of active batches from ``stg_batches`` ordered by ``loaded_at``.

    Pass the returned ``next_cursor`` on subsequent requests.  Optionally
    filter by ``site`` to pull stock for a single branch.
    """
    return service.get_catalog_stock(site=site, cursor=cursor, limit=limit)
