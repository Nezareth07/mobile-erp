from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.repositories.role_repository import RoleRepository
from app.modules.auth.repositories.user_repository import UserRepository
from app.modules.auth.schemas.user_create import UserCreate
from app.modules.auth.schemas.user_password_change import UserPasswordChange
from app.modules.auth.schemas.user_role_assignment import UserRoleAssignment
from app.modules.auth.schemas.user_update import UserUpdate
from app.modules.auth.security.password_hasher import PasswordHasher


class UserService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = UserRepository(session)
        self.role_repository = RoleRepository(session)

    async def get_user(
        self,
        user_id: UUID,
    ) -> User:
        user = await self.repository.get_by_id(user_id)

        if user is None:
            raise NotFoundException("User not found.")

        return user

    async def get_users(
        self,
    ) -> list[User]:
        return await self.repository.get_active()

    async def create_user(
        self,
        data: UserCreate,
    ) -> User:

        if await self.repository.email_exists(data.email):
            raise ConflictException("Email already registered.")

        roles = await self._resolve_roles(data.role_ids)

        user = User(
            email=data.email,
            full_name=data.full_name,
            password_hash=self._hash_password(data.password),
        )

        user.roles = roles

        await self.repository.create(user)

        await self.session.flush()

        await self.session.commit()

        return await self.get_user(user.id)

    async def update_user(
        self,
        user_id: UUID,
        data: UserUpdate,
    ) -> User:

        user = await self.get_user(user_id)

        if (
            data.email
            and data.email != user.email
            and await self.repository.email_exists(data.email)
        ):
            raise ConflictException("Email already registered.")

        if data.email is not None:
            user.email = data.email

        if data.full_name is not None:
            user.full_name = data.full_name

        await self.session.commit()

        return await self.get_user(user_id)

    async def deactivate_user(
        self,
        user_id: UUID,
    ) -> None:

        user = await self.get_user(user_id)

        user.is_active = False

        await self.session.commit()

    async def change_password(
        self,
        user_id: UUID,
        data: UserPasswordChange,
    ) -> None:

        user = await self.get_user(user_id)

        if not PasswordHasher.verify(
            data.current_password,
            user.password_hash,
        ):
            raise BadRequestException("Current password is incorrect.")

        user.password_hash = self._hash_password(data.new_password)

        await self.session.commit()

    async def assign_roles(
        self,
        user_id: UUID,
        data: UserRoleAssignment,
    ) -> User:

        user = await self.get_user(user_id)

        roles = await self._resolve_roles(data.role_ids)

        user.roles = roles

        await self.session.flush()

        await self.session.commit()

        return await self.get_user(user_id)

    async def _resolve_roles(
        self,
        role_ids: list[UUID],
    ) -> list[Role]:

        if not role_ids:
            return []

        roles = await self.role_repository.get_by_ids(role_ids)

        missing = set(role_ids) - {r.id for r in roles}

        if missing:
            raise NotFoundException(
                "Role(s) not found: "
                + ", ".join(str(m) for m in missing)
                + "."
            )

        inactive = [r.name for r in roles if not r.is_active]

        if inactive:
            raise BadRequestException(
                "Role(s) not active: " + ", ".join(inactive) + "."
            )

        return roles

    def _hash_password(
        self,
        password: str,
    ) -> str:
        try:
            return PasswordHasher.hash(password)
        except ValueError:
            raise BadRequestException(
                "Password exceeds the maximum allowed size once encoded."
            )
