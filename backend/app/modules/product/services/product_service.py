from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    BadRequestException,
)
from app.modules.product.models.product import Product
from app.modules.product.repositories.brand_repository import BrandRepository
from app.modules.product.repositories.category_repository import (
    CategoryRepository,
)
from app.modules.product.repositories.product_repository import (
    ProductRepository,
)
from app.modules.product.schemas.product_create import ProductCreate
from app.modules.product.schemas.product_update import ProductUpdate


class ProductService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session

        self.product_repository = ProductRepository(session)
        self.brand_repository = BrandRepository(session)
        self.category_repository = CategoryRepository(session)

    async def get_product(
        self,
        product_id: UUID,
    ) -> Product:

        product = await self.product_repository.get_by_id(product_id)

        if product is None:
            raise NotFoundException("Product not found.")

        return product

    async def get_products(
        self,
    ) -> list[Product]:
        return await self.product_repository.get_active()

    async def create_product(
        self,
        data: ProductCreate,
    ) -> Product:

        if await self.product_repository.sku_exists(data.sku):
            raise ConflictException("SKU already exists.")

        brand = await self.brand_repository.get_by_id(
            data.brand_id,
        )

        if brand is None:
            raise NotFoundException("Brand not found.")

        category = await self.category_repository.get_by_id(
            data.category_id,
        )

        if category is None:
            raise NotFoundException("Category not found.")

        if data.sale_price < data.cost_price:
            raise BadRequestException(
                "Sale price cannot be lower than cost price."
            )

        product = Product(
            name=data.name,
            description=data.description,
            sku=data.sku,
            brand_id=data.brand_id,
            category_id=data.category_id,
            tracking_type=data.tracking_type,
            cost_price=data.cost_price,
            sale_price=data.sale_price,
        )

        await self.product_repository.create(product)

        await self.session.commit()

        return await self.get_product(product.id)

    async def update_product(
        self,
        product_id: UUID,
        data: ProductUpdate,
    ) -> Product:

        product = await self.get_product(product_id)

        if (
            data.sku
            and data.sku != product.sku
            and await self.product_repository.sku_exists(data.sku)
        ):
            raise ConflictException("SKU already exists.")

        if (
            data.cost_price is not None
            and data.sale_price is not None
            and data.sale_price < data.cost_price
        ):
            raise BadRequestException(
                "Sale price cannot be lower than cost price."
            )

        if data.name is not None:
            product.name = data.name

        if data.description is not None:
            product.description = data.description

        if data.sku is not None:
            product.sku = data.sku

        if data.brand_id is not None:
            product.brand_id = data.brand_id

        if data.category_id is not None:
            product.category_id = data.category_id

        if data.tracking_type is not None:
            product.tracking_type = data.tracking_type

        if data.cost_price is not None:
            product.cost_price = data.cost_price

        if data.sale_price is not None:
            product.sale_price = data.sale_price

        await self.session.commit()

        return await self.get_product(product.id)

    async def delete_product(
        self,
        product_id: UUID,
    ) -> None:

        product = await self.get_product(product_id)

        product.is_active = False

        await self.session.commit()