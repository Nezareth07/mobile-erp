from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.modules.auth.models.role import Role
from app.modules.auth.repositories.permission_repository import (
    PermissionRepository,
)
from app.modules.auth.repositories.role_repository import RoleRepository
from app.modules.auth.schemas.role_create import RoleCreate
from app.modules.auth.schemas.role_permission_assignment import (
    RolePermissionAssignment,
)
from app.modules.auth.schemas.role_update import RoleUpdate


class RoleService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = RoleRepository(session)
        self.permission_repository = PermissionRepository(session)

    async def get_role(
        self,
        role_id: UUID,
    ) -> Role:
        role = await self.repository.get_by_id(role_id)

        if role is None:
            raise NotFoundException("Role not found.")

        return role

    async def get_roles(
        self,
    ) -> list[Role]:
        return await self.repository.get_active()

    async def create_role(
        self,
        data: RoleCreate,
    ) -> Role:

        if await self.repository.name_exists(data.name):
            raise ConflictException("Role already exists.")

        role = Role(
            name=data.name,
            description=data.description,
        )

        await self.repository.create(role)

        await self.session.commit()

        return await self.get_role(role.id)

    async def update_role(
        self,
        role_id: UUID,
        data: RoleUpdate,
    ) -> Role:

        role = await self.get_role(role_id)

        if (
            data.name
            and data.name != role.name
            and await self.repository.name_exists(data.name)
        ):
            raise ConflictException("Role already exists.")

        if data.name is not None:
            role.name = data.name

        if data.description is not None:
            role.description = data.description

        await self.session.commit()

        return await self.get_role(role_id)

    async def deactivate_role(
        self,
        role_id: UUID,
    ) -> None:

        role = await self.get_role(role_id)

        role.is_active = False

        await self.session.commit()

    async def assign_permissions(
        self,
        role_id: UUID,
        data: RolePermissionAssignment,
    ) -> Role:

        role = await self.get_role(role_id)

        permissions = await self.permission_repository.get_by_ids(
            data.permission_ids
        )

        missing = set(data.permission_ids) - {p.id for p in permissions}

        if missing:
            raise NotFoundException(
                "Permission(s) not found: "
                + ", ".join(str(m) for m in missing)
                + "."
            )

        role.permissions = permissions

        await self.session.flush()

        await self.session.commit()

        return await self.get_role(role_id)
