from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.sale.models.sale import Sale
from app.modules.sale.models.sale_line import SaleLine


class SaleRepository(BaseRepository[Sale]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Sale)

    async def get_by_id(
        self,
        sale_id: UUID,
    ) -> Sale | None:
        query = (
            select(Sale)
            .where(Sale.id == sale_id)
            .options(
                selectinload(Sale.customer),
                selectinload(Sale.location),
                selectinload(Sale.lines).selectinload(SaleLine.product),
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list_paginated(
        self,
        customer_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[Sale]:
        query = (
            select(Sale)
            .options(
                selectinload(Sale.customer),
                selectinload(Sale.location),
                selectinload(Sale.lines).selectinload(SaleLine.product),
            )
            .order_by(Sale.sale_date.desc())
            .limit(limit)
            .offset(offset)
        )

        if customer_id is not None:
            query = query.where(Sale.customer_id == customer_id)

        result = await self.session.execute(query)

        return list(result.scalars().all())
