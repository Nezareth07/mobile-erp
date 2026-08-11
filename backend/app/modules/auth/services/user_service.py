from uuid import UUID
from zlib import crc32

from sqlalchemy import text
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

ADMIN_ROLE_NAME = "ADMIN"

# Clave arbitraria y fija para el advisory lock que serializa
# UserService.bootstrap_admin() entre procesos concurrentes. Derivada de
# forma determinista de un string descriptivo -- no reutilizar esta clave
# para ningun otro pg_advisory_xact_lock del sistema.
_BOOTSTRAP_ADMIN_LOCK_KEY = crc32(b"mobileerp:bootstrap_admin")


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

    async def bootstrap_admin(
        self,
        email: str,
        full_name: str,
        password: str,
    ) -> tuple[User, bool]:
        """Crea el primer usuario ADMIN si todavia no existe uno activo.

        Devuelve (user, created). created=False significa que ya existia
        un ADMIN activo y no se creo ni modifico nada (idempotente).
        """

        # Primera operacion de la transaccion: serializa bootstraps
        # concurrentes. Transaction-scoped -- se libera solo en
        # commit()/rollback(), sin necesidad de unlock manual, y Postgres
        # lo libera igual si el proceso muere a mitad de camino.
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(CAST(:key AS BIGINT))").bindparams(
                key=_BOOTSTRAP_ADMIN_LOCK_KEY
            )
        )

        existing_admin = await self._find_active_admin()

        if existing_admin is not None:
            return existing_admin, False

        admin_role = await self.role_repository.get_by_name(ADMIN_ROLE_NAME)

        if admin_role is None:
            raise NotFoundException(
                "Role 'ADMIN' does not exist. Apply the migration that "
                "seeds it before running this command."
            )

        if not admin_role.is_active:
            raise BadRequestException("Role 'ADMIN' exists but is inactive.")

        if await self.repository.email_exists(email):
            raise ConflictException("Email already registered.")

        user = User(
            email=email,
            full_name=full_name,
            password_hash=self._hash_password(password),
            is_active=True,
        )

        user.roles = [admin_role]

        await self.repository.create(user)

        await self.session.flush()

        await self.session.commit()

        return await self.get_user(user.id), True

    async def _find_active_admin(
        self,
    ) -> User | None:
        active_users = await self.repository.get_active()

        for user in active_users:
            for role in user.roles:
                if role.name == ADMIN_ROLE_NAME and role.is_active:
                    return user

        return None
