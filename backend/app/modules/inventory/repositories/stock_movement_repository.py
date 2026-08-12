from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.inventory.enums.movement_type import MovementType
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

    async def list_filtered(
        self,
        date_from: datetime,
        date_to: datetime,
        product_id: UUID | None,
        location_id: UUID | None,
        movement_type: MovementType | None,
        limit: int,
        offset: int,
    ) -> list[StockMovement]:
        query = (
            select(StockMovement)
            .options(
                selectinload(StockMovement.product),
                selectinload(StockMovement.location),
            )
            .where(
                StockMovement.created_at >= date_from,
                StockMovement.created_at < date_to,
            )
            .order_by(StockMovement.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if product_id is not None:
            query = query.where(StockMovement.product_id == product_id)

        if location_id is not None:
            query = query.where(StockMovement.location_id == location_id)

        if movement_type is not None:
            query = query.where(StockMovement.movement_type == movement_type)

        result = await self.session.execute(query)

        return list(result.scalars().all())
