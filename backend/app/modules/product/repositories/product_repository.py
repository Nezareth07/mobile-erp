from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.product.models.product import Product


class ProductRepository(BaseRepository[Product]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Product)

    async def get_by_sku(
        self,
        sku: str,
    ) -> Product | None:

        query = (
            select(Product)
            .where(Product.sku == sku)
            .options(
                selectinload(Product.brand),
                selectinload(Product.category),
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def sku_exists(
        self,
        sku: str,
    ) -> bool:
        return await self.get_by_sku(sku) is not None

    async def get_active(
        self,
    ) -> list[Product]:

        query = (
            select(Product)
            .where(Product.is_active.is_(True))
            .options(
                selectinload(Product.brand),
                selectinload(Product.category),
            )
            .order_by(Product.name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def get_by_id(
        self,
        product_id,
    ) -> Product | None:

        query = (
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.brand),
                selectinload(Product.category),
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()