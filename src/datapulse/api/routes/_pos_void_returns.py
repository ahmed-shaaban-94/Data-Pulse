"""POS void and returns routes (B6a).

Sub-router for ``pos.py`` facade (issue #543).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from datapulse.api.limiter import limiter
from datapulse.api.routes._pos_routes_deps import (
    CurrentUser,
    ServiceDep,
    _staff_id_of,
    _tenant_id_of,
)
from datapulse.pos.models import (
    ReturnDetailResponse,
    ReturnRequest,
    ReturnResponse,
    VoidRequest,
    VoidResponse,
)
from datapulse.rbac.dependencies import require_permission

router = APIRouter()


@router.post(
    "/transactions/{transaction_id}/void",
    response_model=VoidResponse,
    dependencies=[Depends(require_permission("pos:transaction:void"))],
)
@limiter.limit("10/minute")
async def void_transaction(
    request: Request,
    transaction_id: Annotated[int, Path(ge=1)],
    body: VoidRequest,
    service: ServiceDep,
    user: CurrentUser,
) -> VoidResponse:
    """Void a completed transaction — reverses inventory and writes an audit log.

    Restricted to supervisors / managers. Only ``completed`` transactions
    may be voided; draft transactions should be abandoned by removing items.
    """
    return await service.void_transaction(
        transaction_id=transaction_id,
        tenant_id=_tenant_id_of(user),
        reason=body.reason,
        voided_by=_staff_id_of(user),
    )


@router.post(
    "/returns",
    response_model=ReturnResponse,
    status_code=201,
    dependencies=[Depends(require_permission("pos:return:create"))],
)
@limiter.limit("20/minute")
async def process_return(
    request: Request,
    body: ReturnRequest,
    service: ServiceDep,
    user: CurrentUser,
) -> ReturnResponse:
    """Process a drug return against a completed transaction.

    Creates a return transaction, restocks inventory via FEFO movement,
    and records a ``pos.returns`` audit entry.
    """
    return await service.process_return(
        original_transaction_id=body.original_transaction_id,
        tenant_id=_tenant_id_of(user),
        staff_id=_staff_id_of(user),
        items=list(body.items),
        reason=body.reason,
        refund_method=body.refund_method,
        notes=body.notes,
    )


@router.get("/returns/{return_id}", response_model=ReturnDetailResponse)
@limiter.limit("60/minute")
def get_return(
    request: Request,
    return_id: Annotated[int, Path(ge=1)],
    service: ServiceDep,
    user: CurrentUser,
) -> ReturnDetailResponse:
    """Fetch a single return record with its line items."""
    _ = user
    detail = service.get_return(return_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Return {return_id} not found")
    return detail


@router.get(
    "/transactions/{transaction_id}/returns",
    response_model=list[ReturnResponse],
)
@limiter.limit("60/minute")
def list_transaction_returns(
    request: Request,
    transaction_id: Annotated[int, Path(ge=1)],
    service: ServiceDep,
    user: CurrentUser,
) -> list[ReturnResponse]:
    """List all return records for an original transaction."""
    _ = user
    return service.list_returns_for_transaction(transaction_id)


@router.get("/returns", response_model=list[ReturnResponse])
@limiter.limit("60/minute")
def list_returns(
    request: Request,
    service: ServiceDep,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ReturnResponse]:
    """List all return records for the tenant, most recent first."""
    return service.list_returns(
        _tenant_id_of(user),
        limit=limit,
        offset=offset,
    )
