from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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

    async def list_recent(
        self,
        limit: int,
        location_id: UUID | None,
    ) -> list[StockMovement]:
        query = (
            select(StockMovement)
            .options(
                selectinload(StockMovement.product),
                selectinload(StockMovement.location),
            )
            .order_by(StockMovement.created_at.desc())
            .limit(limit)
        )

        if location_id is not None:
            query = query.where(StockMovement.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.scalars().all())
