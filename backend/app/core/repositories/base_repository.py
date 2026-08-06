from typing import Generic, TypeVar
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.base import Base


ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):

    def __init__(
        self,
        session: AsyncSession,
        model: type[ModelType],
    ):
        self.session = session
        self.model = model

    async def get_by_id(
        self,
        id: uuid.UUID,
    ) -> ModelType | None:

        return await self.session.get(
            self.model,
            id,
        )

    async def get_all(
        self,
    ) -> list[ModelType]:

        result = await self.session.execute(
            select(self.model)
        )

        return list(result.scalars().all())

    async def create(
        self,
        entity: ModelType,
    ) -> ModelType:

        self.session.add(entity)

        return entity

    async def delete(
        self,
        entity: ModelType,
    ) -> None:

        await self.session.delete(entity)