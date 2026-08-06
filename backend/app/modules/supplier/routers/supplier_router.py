from uuid import UUID

from fastapi import APIRouter, Depends

from app.modules.supplier.dependencies import get_supplier_service
from app.modules.supplier.schemas.supplier_create import SupplierCreate
from app.modules.supplier.schemas.supplier_response import SupplierResponse
from app.modules.supplier.schemas.supplier_update import SupplierUpdate
from app.modules.supplier.services.supplier_service import SupplierService

router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"],
)


@router.post(
    "",
    response_model=SupplierResponse,
    status_code=201,
)
async def create_supplier(
    data: SupplierCreate,
    service: SupplierService = Depends(get_supplier_service),
):
    return await service.create_supplier(data)


@router.get(
    "",
    response_model=list[SupplierResponse],
)
async def get_suppliers(
    service: SupplierService = Depends(get_supplier_service),
):
    return await service.get_suppliers()


@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
)
async def get_supplier(
    supplier_id: UUID,
    service: SupplierService = Depends(get_supplier_service),
):
    return await service.get_supplier(supplier_id)


@router.put(
    "/{supplier_id}",
    response_model=SupplierResponse,
)
async def update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    service: SupplierService = Depends(get_supplier_service),
):
    return await service.update_supplier(
        supplier_id,
        data,
    )


@router.delete(
    "/{supplier_id}",
    status_code=204,
)
async def delete_supplier(
    supplier_id: UUID,
    service: SupplierService = Depends(get_supplier_service),
):
    await service.delete_supplier(supplier_id)
