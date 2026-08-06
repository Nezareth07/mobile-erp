from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.product.models.brand import Brand
from app.modules.product.repositories.brand_repository import BrandRepository
from app.modules.product.schemas.brand_create import BrandCreate
from app.modules.product.schemas.brand_update import BrandUpdate
from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)


class BrandService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = BrandRepository(session)

    async def get_brand(
        self,
        brand_id: UUID,
    ) -> Brand | None:
        return await self.repository.get_by_id(brand_id)

    async def get_brands(
        self,
    ) -> list[Brand]:
        return await self.repository.get_active()

    async def create_brand(
        self,
        data: BrandCreate,
    ) -> Brand:

        if await self.repository.name_exists(data.name):
            raise ConflictException("Brand already exists.")

        brand = Brand(
            name=data.name,
        )

        await self.repository.create(brand)

        await self.session.commit()

        await self.session.refresh(brand)

        return brand

    async def update_brand(
        self,
        brand_id: UUID,
        data: BrandUpdate,
    ) -> Brand:

        brand = await self.repository.get_by_id(brand_id)

        if brand is None:
            raise NotFoundException("Brand not found.")

        if (
            data.name
            and data.name != brand.name
            and await self.repository.name_exists(data.name)
        ):
            raise ConflictException("Brand already exists.")

        if data.name is not None:
            brand.name = data.name

        await self.session.commit()

        await self.session.refresh(brand)

        return brand

    async def delete_brand(
        self,
        brand_id: UUID,
    ) -> None:

        brand = await self.repository.get_by_id(brand_id)

        if brand is None:
            raise NotFoundException("Brand not found.")

        brand.is_active = False

        await self.session.commit()