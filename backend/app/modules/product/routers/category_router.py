from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.auth.dependencies import require_permission
from app.modules.product.schemas.category_create import (
    CategoryCreate,
)
from app.modules.product.schemas.category_response import (
    CategoryResponse,
)
from app.modules.product.schemas.category_update import (
    CategoryUpdate,
)
from app.modules.product.services.category_service import (
    CategoryService,
)

router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
)


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=201,
    dependencies=[Depends(require_permission("categories.create"))],
)
async def create_category(
    data: CategoryCreate,
    session: AsyncSession = Depends(get_session),
):
    service = CategoryService(session)

    return await service.create_category(data)


@router.get(
    "",
    response_model=list[CategoryResponse],
    dependencies=[Depends(require_permission("categories.read"))],
)
async def get_categories(
    session: AsyncSession = Depends(get_session),
):
    service = CategoryService(session)

    return await service.get_categories()


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
    dependencies=[Depends(require_permission("categories.read"))],
)
async def get_category(
    category_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    service = CategoryService(session)

    return await service.get_category(category_id)


@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
    dependencies=[Depends(require_permission("categories.update"))],
)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    session: AsyncSession = Depends(get_session),
):
    service = CategoryService(session)

    return await service.update_category(
        category_id,
        data,
    )


@router.delete(
    "/{category_id}",
    status_code=204,
    dependencies=[Depends(require_permission("categories.delete"))],
)
async def delete_category(
    category_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    service = CategoryService(session)

    await service.delete_category(category_id)