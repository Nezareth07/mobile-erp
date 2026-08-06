from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.modules.purchase.dependencies import get_purchase_service
from app.modules.purchase.schemas.purchase_create import PurchaseCreate
from app.modules.purchase.schemas.purchase_response import PurchaseResponse
from app.modules.purchase.services.purchase_service import PurchaseService

router = APIRouter(
    prefix="/purchases",
    tags=["Purchases"],
)


@router.post(
    "",
    response_model=PurchaseResponse,
    status_code=201,
)
async def create_purchase(
    data: PurchaseCreate,
    service: PurchaseService = Depends(get_purchase_service),
):
    return await service.create_purchase(data)


@router.get(
    "",
    response_model=list[PurchaseResponse],
)
async def get_purchases(
    supplier_id: UUID | None = None,
    limit: int = Query(default=50, gt=0, le=200),
    offset: int = Query(default=0, ge=0),
    service: PurchaseService = Depends(get_purchase_service),
):
    return await service.get_purchases(supplier_id, limit, offset)


@router.get(
    "/{purchase_id}",
    response_model=PurchaseResponse,
)
async def get_purchase(
    purchase_id: UUID,
    service: PurchaseService = Depends(get_purchase_service),
):
    return await service.get_purchase(purchase_id)
