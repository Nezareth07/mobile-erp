from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.inventory.models.stock_movement import StockMovement


class StockMovementRepository(BaseRepository[StockMovement]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, StockMovement)

    async def list_by_product(
        self,
        product_id: UUID,
    ) -> list[StockMovement]:
        query = (
            select(StockMovement)
            .where(StockMovement.product_id == product_id)
            .order_by(StockMovement.created_at)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())
