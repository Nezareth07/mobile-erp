from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.supplier.models.supplier import Supplier


class SupplierRepository(BaseRepository[Supplier]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Supplier)

    async def get_by_name(
        self,
        name: str,
    ) -> Supplier | None:
        query = select(Supplier).where(
            Supplier.name == name,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def name_exists(
        self,
        name: str,
    ) -> bool:
        return await self.get_by_name(name) is not None

    async def get_by_tax_id(
        self,
        tax_id: str,
    ) -> Supplier | None:
        query = select(Supplier).where(
            Supplier.tax_id == tax_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def tax_id_exists(
        self,
        tax_id: str,
    ) -> bool:
        return await self.get_by_tax_id(tax_id) is not None

    async def get_active(
        self,
    ) -> list[Supplier]:
        query = (
            select(Supplier)
            .where(Supplier.is_active.is_(True))
            .order_by(Supplier.name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def count_active(
        self,
    ) -> int:
        query = select(func.count()).where(Supplier.is_active.is_(True))

        result = await self.session.execute(query)

        return result.scalar_one()
