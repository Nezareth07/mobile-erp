from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.repositories.base_repository import BaseRepository
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole


class UserRepository(BaseRepository[User]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, User)

    async def get_by_id(
        self,
        user_id: UUID,
    ) -> User | None:
        query = (
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.roles).selectinload(Role.permissions)
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def get_by_email(
        self,
        email: str,
    ) -> User | None:
        query = select(User).where(
            User.email == email,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def email_exists(
        self,
        email: str,
    ) -> bool:
        return await self.get_by_email(email) is not None

    async def get_active(
        self,
    ) -> list[User]:
        query = (
            select(User)
            .where(User.is_active.is_(True))
            .options(selectinload(User.roles))
            .order_by(User.full_name)
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())

    async def count_active_users_with_role(
        self,
        role_name: str,
    ) -> int:
        query = (
            select(func.count(func.distinct(User.id)))
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                User.is_active.is_(True),
                Role.name == role_name,
                Role.is_active.is_(True),
            )
        )

        result = await self.session.execute(query)

        return result.scalar_one()
