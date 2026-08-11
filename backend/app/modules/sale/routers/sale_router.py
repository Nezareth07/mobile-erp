from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.modules.auth.dependencies import require_permission
from app.modules.sale.dependencies import get_sale_service
from app.modules.sale.schemas.sale_create import SaleCreate
from app.modules.sale.schemas.sale_response import SaleResponse
from app.modules.sale.services.sale_service import SaleService

router = APIRouter(
    prefix="/sales",
    tags=["Sales"],
)


@router.post(
    "",
    response_model=SaleResponse,
    status_code=201,
    dependencies=[Depends(require_permission("sales.create"))],
)
async def create_sale(
    data: SaleCreate,
    service: SaleService = Depends(get_sale_service),
):
    return await service.create_sale(data)


@router.get(
    "",
    response_model=list[SaleResponse],
    dependencies=[Depends(require_permission("sales.read"))],
)
async def get_sales(
    customer_id: UUID | None = None,
    limit: int = Query(default=50, gt=0, le=200),
    offset: int = Query(default=0, ge=0),
    service: SaleService = Depends(get_sale_service),
):
    return await service.get_sales(customer_id, limit, offset)


@router.get(
    "/{sale_id}",
    response_model=SaleResponse,
    dependencies=[Depends(require_permission("sales.read"))],
)
async def get_sale(
    sale_id: UUID,
    service: SaleService = Depends(get_sale_service),
):
    return await service.get_sale(sale_id)
