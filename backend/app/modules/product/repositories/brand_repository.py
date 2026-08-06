from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.product.models.brand import Brand


class BrandRepository(BaseRepository[Brand]):
    def __init__(self, session: AsyncSession):
        super().__init__(session, Brand)

    async def get_by_name(
        self,
        name: str,
    ) -> Brand | None:
        query = select(Brand).where(
            Brand.name == name,
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
    ) -> list[Brand]:
        query = (
            select(Brand)
            .where(Brand.is_active.is_(True))
            .order_by(Brand.name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())