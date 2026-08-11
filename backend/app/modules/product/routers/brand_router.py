from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.auth.dependencies import require_permission
from app.modules.product.schemas.brand_create import BrandCreate
from app.modules.product.schemas.brand_response import BrandResponse
from app.modules.product.schemas.brand_update import BrandUpdate
from app.modules.product.services.brand_service import BrandService

router = APIRouter(
    prefix="/brands",
    tags=["Brands"],
)


@router.post(
    "",
    response_model=BrandResponse,
    status_code=201,
    dependencies=[Depends(require_permission("brands.create"))],
)
async def create_brand(
    data: BrandCreate,
    session: AsyncSession = Depends(get_session),
):
    service = BrandService(session)

    return await service.create_brand(data)


@router.get(
    "",
    response_model=list[BrandResponse],
    dependencies=[Depends(require_permission("brands.read"))],
)
async def get_brands(
    session: AsyncSession = Depends(get_session),
):
    service = BrandService(session)

    return await service.get_brands()


@router.get(
    "/{brand_id}",
    response_model=BrandResponse,
    dependencies=[Depends(require_permission("brands.read"))],
)
async def get_brand(
    brand_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    service = BrandService(session)

    return await service.get_brand(brand_id)


@router.put(
    "/{brand_id}",
    response_model=BrandResponse,
    dependencies=[Depends(require_permission("brands.update"))],
)
async def update_brand(
    brand_id: UUID,
    data: BrandUpdate,
    session: AsyncSession = Depends(get_session),
):
    service = BrandService(session)

    return await service.update_brand(
        brand_id,
        data,
    )


@router.delete(
    "/{brand_id}",
    status_code=204,
    dependencies=[Depends(require_permission("brands.delete"))],
)
async def delete_brand(
    brand_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    service = BrandService(session)

    await service.delete_brand(brand_id)