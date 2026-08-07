from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.customer.models.customer import Customer


class CustomerRepository(BaseRepository[Customer]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Customer)

    async def get_by_document_id(
        self,
        document_id: str,
    ) -> Customer | None:
        query = select(Customer).where(
            Customer.document_id == document_id,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def document_id_exists(
        self,
        document_id: str,
    ) -> bool:
        return await self.get_by_document_id(document_id) is not None

    async def get_active(
        self,
    ) -> list[Customer]:
        query = (
            select(Customer)
            .where(Customer.is_active.is_(True))
            .order_by(Customer.name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def get_default(
        self,
    ) -> Customer | None:
        query = select(Customer).where(
            Customer.is_default_customer.is_(True),
            Customer.is_active.is_(True),
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()
