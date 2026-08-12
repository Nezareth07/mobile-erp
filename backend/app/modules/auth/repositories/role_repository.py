from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole


class RoleRepository(BaseRepository[Role]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Role)

    async def get_by_id(
        self,
        role_id: UUID,
    ) -> Role | None:
        query = (
            select(Role)
            .where(Role.id == role_id)
            .options(selectinload(Role.permissions))
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_by_name(
        self,
        name: str,
    ) -> Role | None:
        query = select(Role).where(
            Role.name == name,
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
    ) -> list[Role]:
        query = (
            select(Role)
            .where(Role.is_active.is_(True))
            .options(selectinload(Role.permissions))
            .order_by(Role.name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def get_by_ids(
        self,
        role_ids: list[UUID],
    ) -> list[Role]:
        query = select(Role).where(
            Role.id.in_(role_ids),
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def has_active_users(
        self,
        role_id: UUID,
    ) -> bool:
        query = (
            select(func.count())
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .where(
                UserRole.role_id == role_id,
                User.is_active.is_(True),
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one() > 0
