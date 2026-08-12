from datetime import datetime
from uuid import UUID

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.product.models.product import Product
from app.modules.purchase.enums.purchase_status import PurchaseStatus
from app.modules.purchase.models.purchase import Purchase
from app.modules.purchase.models.purchase_line import PurchaseLine


class PurchaseLineRepository(BaseRepository[PurchaseLine]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, PurchaseLine)

    async def get_top_products(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
        limit: int,
        order_by_quantity: bool,
    ) -> list[Row]:
        quantity_purchased = func.coalesce(func.sum(PurchaseLine.quantity), 0)
        total_cost = func.coalesce(func.sum(PurchaseLine.subtotal), 0)
        ranking = quantity_purchased if order_by_quantity else total_cost

        query = (
            select(Product, quantity_purchased, total_cost)
            .join(Purchase, PurchaseLine.purchase_id == Purchase.id)
            .join(Product, PurchaseLine.product_id == Product.id)
            .where(
                Purchase.status == PurchaseStatus.CONFIRMED,
                Purchase.purchase_date >= date_from,
                Purchase.purchase_date < date_to,
            )
            .group_by(Product.id)
            .order_by(ranking.desc())
            .limit(limit)
        )

        if location_id is not None:
            query = query.where(Purchase.location_id == location_id)

        result = await self.session.execute(query)

        return list(result.all())
