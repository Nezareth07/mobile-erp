from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.product.models.category import Category


class CategoryRepository(BaseRepository[Category]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Category)

    async def get_by_name(
        self,
        name: str,
    ) -> Category | None:
        query = select(Category).where(
            Category.name == name,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def name_exists(
        self,
        name: str,
    ) -> bool:
        return await self.get_by_name(name) is not None

    async def get_active(
        self,
    ) -> list[Category]:
        query = (
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())