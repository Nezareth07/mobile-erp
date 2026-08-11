from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.auth.dependencies import require_permission
from app.modules.product.schemas.product_create import ProductCreate
from app.modules.product.schemas.product_response import ProductResponse
from app.modules.product.schemas.product_update import ProductUpdate
from app.modules.product.services.product_service import ProductService

router = APIRouter(
    prefix="/products",
    tags=["Products"],
)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=201,
    dependencies=[Depends(require_permission("products.create"))],
)
async def create_product(
    data: ProductCreate,
    session: AsyncSession = Depends(get_session),
):
    service = ProductService(session)

    return await service.create_product(data)


@router.get(
    "",
    response_model=list[ProductResponse],
    dependencies=[Depends(require_permission("products.read"))],
)
async def get_products(
    session: AsyncSession = Depends(get_session),
):
    service = ProductService(session)

    return await service.get_products()


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("products.read"))],
)
async def get_product(
    product_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    service = ProductService(session)

    return await service.get_product(product_id)


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("products.update"))],
)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    session: AsyncSession = Depends(get_session),
):
    service = ProductService(session)

    return await service.update_product(
        product_id,
        data,
    )


@router.delete(
    "/{product_id}",
    status_code=204,
    dependencies=[Depends(require_permission("products.delete"))],
)
async def delete_product(
    product_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    service = ProductService(session)

    await service.delete_product(product_id)