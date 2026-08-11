from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.auth.models.permission import Permission


class PermissionRepository(BaseRepository[Permission]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, Permission)

    async def get_by_code(
        self,
        code: str,
    ) -> Permission | None:
        query = select(Permission).where(
            Permission.code == code,
        )

        result = await self.session.execute(query)

        return result.scalar_one_or_none()

    async def code_exists(
        self,
        code: str,
    ) -> bool:
        return await self.get_by_code(code) is not None

    async def get_by_ids(
        self,
        permission_ids: list[UUID],
    ) -> list[Permission]:
        query = select(Permission).where(
            Permission.id.in_(permission_ids),
        )

        result = await self.session.execute(query)

        return list(result.scalars().all())
