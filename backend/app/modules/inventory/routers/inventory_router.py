from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.auth.dependencies import require_permission
from app.modules.inventory.dependencies import get_inventory_service
from app.modules.inventory.enums.product_unit_status import ProductUnitStatus
from app.modules.inventory.schemas.available_stock_response import (
    AvailableStockResponse,
)
from app.modules.inventory.schemas.batch_intake_create import BatchIntakeCreate
from app.modules.inventory.schemas.product_unit_response import (
    ProductUnitResponse,
)
from app.modules.inventory.schemas.serial_intake_create import SerialIntakeCreate
from app.modules.inventory.schemas.stock_adjustment_create import (
    StockAdjustmentCreate,
)
from app.modules.inventory.schemas.stock_lot_response import StockLotResponse
from app.modules.inventory.services.inventory_service import InventoryService

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
)


@router.post(
    "/intake/serial",
    response_model=ProductUnitResponse,
    status_code=201,
    dependencies=[Depends(require_permission("inventory.intake"))],
)
async def register_serial_intake(
    data: SerialIntakeCreate,
    service: InventoryService = Depends(get_inventory_service),
    session: AsyncSession = Depends(get_session),
):
    result = await service.register_serial_intake(data)
    await session.commit()

    return result


@router.post(
    "/intake/batch",
    response_model=StockLotResponse,
    status_code=201,
    dependencies=[Depends(require_permission("inventory.intake"))],
)
async def register_batch_intake(
    data: BatchIntakeCreate,
    service: InventoryService = Depends(get_inventory_service),
    session: AsyncSession = Depends(get_session),
):
    result = await service.register_batch_intake(data)
    await session.commit()

    return result


@router.get(
    "/products/{product_id}/stock",
    response_model=AvailableStockResponse,
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def get_available_stock(
    product_id: UUID,
    service: InventoryService = Depends(get_inventory_service),
):
    return await service.get_available_stock(product_id)


@router.get(
    "/products/{product_id}/units",
    response_model=list[ProductUnitResponse],
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def list_units(
    product_id: UUID,
    status: ProductUnitStatus | None = None,
    service: InventoryService = Depends(get_inventory_service),
):
    return await service.list_units(product_id, status)


@router.get(
    "/units/by-imei/{imei}",
    response_model=ProductUnitResponse,
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def get_unit_by_imei(
    imei: str,
    service: InventoryService = Depends(get_inventory_service),
):
    return await service.get_unit_by_imei(imei)


@router.post(
    "/adjustments",
    response_model=AvailableStockResponse,
    dependencies=[Depends(require_permission("inventory.adjust"))],
)
async def adjust_stock(
    data: StockAdjustmentCreate,
    service: InventoryService = Depends(get_inventory_service),
    session: AsyncSession = Depends(get_session),
):
    result = await service.adjust_stock(data)
    await session.commit()

    return result
