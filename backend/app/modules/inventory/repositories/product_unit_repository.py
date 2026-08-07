from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.inventory.enums.product_unit_status import ProductUnitStatus
from app.modules.inventory.models.product_unit import ProductUnit


class ProductUnitRepository(BaseRepository[ProductUnit]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, ProductUnit)

    async def get_by_imei(
        self,
        imei: str,
    ) -> ProductUnit | None:
        query = (
            select(ProductUnit)
            .where((ProductUnit.imei == imei) | (ProductUnit.imei2 == imei))
            .options(selectinload(ProductUnit.location))
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def imei_exists(
        self,
        imei: str,
    ) -> bool:
        return await self.get_by_imei(imei) is not None

    async def list_by_product(
        self,
        product_id: UUID,
        status: ProductUnitStatus | None = None,
    ) -> list[ProductUnit]:
        query = (
            select(ProductUnit)
            .where(ProductUnit.product_id == product_id)
            .options(selectinload(ProductUnit.location))
        )

        if status is not None:
            query = query.where(ProductUnit.status == status)

        query = query.order_by(ProductUnit.created_at)

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def count_available_by_product(
        self,
        product_id: UUID,
    ) -> int:
        query = select(func.count()).where(
            ProductUnit.product_id == product_id,
            ProductUnit.status == ProductUnitStatus.IN_STOCK,
        )

        result = await self.session.execute(query)

        return result.scalar_one()

    async def get_for_update(
        self,
        unit_id: UUID,
    ) -> ProductUnit | None:
        query = (
            select(ProductUnit)
            .where(ProductUnit.id == unit_id)
            .with_for_update()
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()
