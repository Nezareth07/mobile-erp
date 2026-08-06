from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.inventory.models.stock_lot import StockLot


class StockLotRepository(BaseRepository[StockLot]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, StockLot)

    async def get_by_id(
        self,
        lot_id: UUID,
    ) -> StockLot | None:
        query = (
            select(StockLot)
            .where(StockLot.id == lot_id)
            .options(selectinload(StockLot.location))
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list_by_product(
        self,
        product_id: UUID,
    ) -> list[StockLot]:
        query = (
            select(StockLot)
            .where(StockLot.product_id == product_id)
            .options(selectinload(StockLot.location))
            .order_by(StockLot.received_at)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def get_for_update(
        self,
        lot_id: UUID,
    ) -> StockLot | None:
        query = (
            select(StockLot)
            .where(StockLot.id == lot_id)
            .with_for_update()
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def sum_available_by_product(
        self,
        product_id: UUID,
    ) -> int:
        query = select(func.coalesce(func.sum(StockLot.quantity_available), 0)).where(
            StockLot.product_id == product_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one()
