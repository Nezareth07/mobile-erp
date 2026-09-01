from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.modules.product.models.category import Category
from app.modules.product.repositories.category_repository import (
    CategoryRepository,
)
from app.modules.product.schemas.category_create import (
    CategoryCreate,
)
from app.modules.product.schemas.category_update import (
    CategoryUpdate,
)


class CategoryService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = CategoryRepository(session)

    async def get_category(
        self,
        category_id: UUID,
    ) -> Category:
        category = await self.repository.get_by_id(category_id)

        if category is None:
            raise NotFoundException("Category not found.")

        return category

    async def get_categories(
        self,
    ) -> list[Category]:
        return await self.repository.get_active()

    async def create_category(
        self,
        data: CategoryCreate,
    ) -> Category:

        existing = await self.repository.get_by_name(data.name)

        if existing is not None:
            if existing.is_active:
                raise ConflictException(
                    "Category already exists."
                )

            # revive-on-create: la categoria fue desactivada (soft-delete)
            # y ahora se vuelve a crear con el mismo nombre. Se reactiva la
            # fila existente en vez de insertar otra, conservando su UUID y
            # todas sus relaciones historicas (product.category_id sigue
            # apuntando al mismo registro). La comparacion de nombre es la
            # misma de get_by_name (igualdad exacta, sin normalizacion).
            existing.is_active = True

            await self.session.commit()

            await self.session.refresh(existing)

            return existing

        category = Category(
            name=data.name,
        )

        await self.repository.create(category)

        await self.session.commit()

        await self.session.refresh(category)

        return category

    async def update_category(
        self,
        category_id: UUID,
        data: CategoryUpdate,
    ) -> Category:

        category = await self.get_category(category_id)

        if (
            data.name
            and data.name != category.name
            and await self.repository.name_exists(data.name)
        ):
            raise ConflictException(
                "Category already exists."
            )

        if data.name is not None:
            category.name = data.name

        await self.session.commit()

        await self.session.refresh(category)

        return category

    async def delete_category(
        self,
        category_id: UUID,
    ) -> None:

        category = await self.get_category(category_id)

        category.is_active = False

        await self.session.commit()