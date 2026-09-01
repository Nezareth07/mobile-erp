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

        existing = await self.repository.get_by_name(data.name)

        if existing is not None:
            if existing.is_active:
                raise ConflictException("Brand already exists.")

            # revive-on-create: la marca fue desactivada (soft-delete) y
            # ahora se vuelve a crear con el mismo nombre. Se reactiva la
            # fila existente en vez de insertar otra, conservando su UUID
            # y todas sus relaciones historicas (product.brand_id sigue
            # apuntando al mismo registro). La comparacion de nombre es la
            # misma de get_by_name (igualdad exacta, sin normalizacion).
            existing.is_active = True

            await self.session.commit()

            await self.session.refresh(existing)

            return existing

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