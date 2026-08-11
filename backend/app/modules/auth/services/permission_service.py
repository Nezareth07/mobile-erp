from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.modules.auth.models.permission import Permission
from app.modules.auth.repositories.permission_repository import (
    PermissionRepository,
)


class PermissionService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = PermissionRepository(session)

    async def get_permission(
        self,
        permission_id: UUID,
    ) -> Permission:
        permission = await self.repository.get_by_id(permission_id)

        if permission is None:
            raise NotFoundException("Permission not found.")

        return permission

    async def get_permissions(
        self,
    ) -> list[Permission]:
        return await self.repository.get_all()
