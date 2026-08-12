from datetime import datetime
from uuid import UUID

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.purchase.enums.purchase_status import PurchaseStatus
from app.modules.purchase.models.purchase import Purchase
from app.modules.purchase.models.purchase_line import PurchaseLine
from app.modules.supplier.models.supplier import Supplier


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

    async def get_summary(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
    ) -> Row:
        query = select(
            func.count(Purchase.id),
            func.coalesce(func.sum(Purchase.total_cost), 0),
        ).where(
            Purchase.status == PurchaseStatus.CONFIRMED,
            Purchase.purchase_date >= date_from,
            Purchase.purchase_date < date_to,
        )

        if location_id is not None:
            query = query.where(Purchase.location_id == location_id)

        result = await self.session.execute(query)

        return result.one()

    async def get_daily_series(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
    ) -> list[Row]:
        day = func.date_trunc("day", Purchase.purchase_date).label("day")

        query = (
            select(
                day,
                func.count(Purchase.id),
                func.coalesce(func.sum(Purchase.total_cost), 0),
            )
            .where(
                Purchase.status == PurchaseStatus.CONFIRMED,
                Purchase.purchase_date >= date_from,
                Purchase.purchase_date < date_to,
            )
            .group_by(day)
            .order_by(day)
        )

        if location_id is not None:
            query = query.where(Purchase.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.all())

    async def get_top_suppliers(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
        limit: int,
    ) -> list[Row]:
        total_cost = func.coalesce(func.sum(Purchase.total_cost), 0)

        query = (
            select(
                Supplier,
                func.count(Purchase.id),
                total_cost,
            )
            .join(Supplier, Purchase.supplier_id == Supplier.id)
            .where(
                Purchase.status == PurchaseStatus.CONFIRMED,
                Purchase.purchase_date >= date_from,
                Purchase.purchase_date < date_to,
            )
            .group_by(Supplier.id)
            .order_by(total_cost.desc())
            .limit(limit)
        )

        if location_id is not None:
            query = query.where(Purchase.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.all())
