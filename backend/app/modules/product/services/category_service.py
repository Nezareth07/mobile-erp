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

        if await self.repository.name_exists(data.name):
            raise ConflictException(
                "Category already exists."
            )

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