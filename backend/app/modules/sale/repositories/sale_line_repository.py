from datetime import datetime
from uuid import UUID

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.product.models.product import Product
from app.modules.sale.enums.sale_status import SaleStatus
from app.modules.sale.models.sale import Sale
from app.modules.sale.models.sale_line import SaleLine


class SaleLineRepository(BaseRepository[SaleLine]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, SaleLine)

    async def get_top_products(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
        limit: int,
        order_by_quantity: bool,
    ) -> list[Row]:
        quantity_sold = func.coalesce(func.sum(SaleLine.quantity), 0)
        revenue = func.coalesce(func.sum(SaleLine.subtotal), 0)
        ranking = quantity_sold if order_by_quantity else revenue

        query = (
            select(Product, quantity_sold, revenue)
            .join(Sale, SaleLine.sale_id == Sale.id)
            .join(Product, SaleLine.product_id == Product.id)
            .where(
                Sale.status == SaleStatus.CONFIRMED,
                Sale.sale_date >= date_from,
                Sale.sale_date < date_to,
            )
            .group_by(Product.id)
            .order_by(ranking.desc())
            .limit(limit)
        )

        if location_id is not None:
            query = query.where(Sale.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.all())
