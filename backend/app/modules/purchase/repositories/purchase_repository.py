from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.purchase.models.purchase import Purchase
from app.modules.purchase.models.purchase_line import PurchaseLine


class PurchaseRepository(BaseRepository[Purchase]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Purchase)

    async def get_by_id(
        self,
        purchase_id: UUID,
    ) -> Purchase | None:
        query = (
            select(Purchase)
            .where(Purchase.id == purchase_id)
            .options(
                selectinload(Purchase.supplier),
                selectinload(Purchase.location),
                selectinload(Purchase.lines).selectinload(PurchaseLine.product),
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def list_paginated(
        self,
        supplier_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[Purchase]:
        query = (
            select(Purchase)
            .options(
                selectinload(Purchase.supplier),
                selectinload(Purchase.location),
                selectinload(Purchase.lines).selectinload(PurchaseLine.product),
            )
            .order_by(Purchase.purchase_date.desc())
            .limit(limit)
            .offset(offset)
        )

        if supplier_id is not None:
            query = query.where(Purchase.supplier_id == supplier_id)

        result = await self.session.execute(query)

        return list(result.scalars().all())
