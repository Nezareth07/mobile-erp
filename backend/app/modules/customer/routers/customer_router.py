from uuid import UUID

from fastapi import APIRouter, Depends

from app.modules.customer.dependencies import get_customer_service
from app.modules.customer.schemas.customer_create import CustomerCreate
from app.modules.customer.schemas.customer_response import CustomerResponse
from app.modules.customer.schemas.customer_update import CustomerUpdate
from app.modules.customer.services.customer_service import CustomerService

router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=201,
)
async def create_customer(
    data: CustomerCreate,
    service: CustomerService = Depends(get_customer_service),
):
    return await service.create_customer(data)


@router.get(
    "",
    response_model=list[CustomerResponse],
)
async def get_customers(
    service: CustomerService = Depends(get_customer_service),
):
    return await service.get_customers()


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
)
async def get_customer(
    customer_id: UUID,
    service: CustomerService = Depends(get_customer_service),
):
    return await service.get_customer(customer_id)


@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    service: CustomerService = Depends(get_customer_service),
):
    return await service.update_customer(
        customer_id,
        data,
    )


@router.delete(
    "/{customer_id}",
    status_code=204,
)
async def delete_customer(
    customer_id: UUID,
    service: CustomerService = Depends(get_customer_service),
):
    await service.delete_customer(customer_id)
