from datetime import datetime
from uuid import UUID

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.customer.models.customer import Customer
from app.modules.sale.enums.sale_status import SaleStatus
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

    async def get_summary(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
    ) -> Row:
        query = select(
            func.count(Sale.id),
            func.coalesce(func.sum(Sale.total_amount), 0),
            func.coalesce(func.sum(Sale.total_cost), 0),
            func.coalesce(func.sum(Sale.profit), 0),
        ).where(
            Sale.status == SaleStatus.CONFIRMED,
            Sale.sale_date >= date_from,
            Sale.sale_date < date_to,
        )

        if location_id is not None:
            query = query.where(Sale.location_id == location_id)

        result = await self.session.execute(query)

        return result.one()

    async def get_daily_series(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
    ) -> list[Row]:
        day = func.date_trunc("day", Sale.sale_date).label("day")

        query = (
            select(
                day,
                func.count(Sale.id),
                func.coalesce(func.sum(Sale.total_amount), 0),
                func.coalesce(func.sum(Sale.total_cost), 0),
                func.coalesce(func.sum(Sale.profit), 0),
            )
            .where(
                Sale.status == SaleStatus.CONFIRMED,
                Sale.sale_date >= date_from,
                Sale.sale_date < date_to,
            )
            .group_by(day)
            .order_by(day)
        )

        if location_id is not None:
            query = query.where(Sale.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.all())

    async def get_top_customers(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
        limit: int,
    ) -> list[Row]:
        revenue = func.coalesce(func.sum(Sale.total_amount), 0)

        query = (
            select(
                Customer,
                func.count(Sale.id),
                revenue,
            )
            .join(Customer, Sale.customer_id == Customer.id)
            .where(
                Sale.status == SaleStatus.CONFIRMED,
                Sale.sale_date >= date_from,
                Sale.sale_date < date_to,
            )
            .group_by(Customer.id)
            .order_by(revenue.desc())
            .limit(limit)
        )

        if location_id is not None:
            query = query.where(Sale.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.all())
