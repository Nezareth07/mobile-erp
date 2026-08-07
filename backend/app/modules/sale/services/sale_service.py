from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.modules.customer.models.customer import Customer
from app.modules.customer.repositories.customer_repository import (
    CustomerRepository,
)
from app.modules.inventory.enums.product_unit_status import ProductUnitStatus
from app.modules.inventory.schemas.batch_sale_create import BatchSaleCreate
from app.modules.inventory.schemas.serial_sale_create import SerialSaleCreate
from app.modules.inventory.services.inventory_service import InventoryService
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.product import Product
from app.modules.product.repositories.product_repository import ProductRepository
from app.modules.sale.enums.sale_status import SaleStatus
from app.modules.sale.models.sale import Sale
from app.modules.sale.models.sale_line import SaleLine
from app.modules.sale.repositories.sale_line_repository import (
    SaleLineRepository,
)
from app.modules.sale.repositories.sale_repository import SaleRepository
from app.modules.sale.schemas.sale_create import SaleCreate


class SaleService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session

        self.sale_repository = SaleRepository(session)
        self.sale_line_repository = SaleLineRepository(session)
        self.customer_repository = CustomerRepository(session)
        self.product_repository = ProductRepository(session)
        self.inventory_service = InventoryService(session)

    async def get_sale(
        self,
        sale_id: UUID,
    ) -> Sale:
        sale = await self.sale_repository.get_by_id(sale_id)

        if sale is None:
            raise NotFoundException("Sale not found.")

        return sale

    async def get_sales(
        self,
        customer_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[Sale]:
        return await self.sale_repository.list_paginated(
            customer_id,
            limit,
            offset,
        )

    async def create_sale(
        self,
        data: SaleCreate,
    ) -> Sale:
        customer = await self._resolve_customer(data.customer_id)

        location = await self.inventory_service.resolve_location(
            data.location_id
        )

        products = await self._validate_lines(data)

        sale = Sale(
            customer_id=customer.id,
            location_id=location.id,
            status=SaleStatus.CONFIRMED,
            sale_date=data.sale_date or datetime.now(timezone.utc),
            total_amount=Decimal("0"),
            total_cost=Decimal("0"),
            profit=Decimal("0"),
            notes=data.notes,
        )

        await self.sale_repository.create(sale)
        await self.session.flush()

        total_amount = Decimal("0")
        total_cost = Decimal("0")

        for line_data in data.lines:
            product = products[line_data.product_id]

            unit_price = (
                line_data.unit_price
                if line_data.unit_price is not None
                else product.sale_price
            )

            subtotal = line_data.quantity * unit_price

            sale_line = SaleLine(
                sale_id=sale.id,
                product_id=product.id,
                quantity=line_data.quantity,
                unit_price=unit_price,
                unit_cost=Decimal("0"),
                subtotal=subtotal,
                imei=line_data.imei,
            )

            await self.sale_line_repository.create(sale_line)
            await self.session.flush()

            if product.tracking_type == TrackingType.SERIAL:
                unit = await self.inventory_service.register_serial_sale(
                    SerialSaleCreate(
                        product_id=product.id,
                        imei=line_data.imei,
                        location_id=location.id,
                        source_reference=str(sale.id),
                    ),
                    sale_line_id=sale_line.id,
                )
                line_cost = unit.unit_cost
            else:
                line_cost = await self.inventory_service.register_batch_sale(
                    BatchSaleCreate(
                        product_id=product.id,
                        quantity=line_data.quantity,
                        location_id=location.id,
                        source_reference=str(sale.id),
                    )
                )

            sale_line.unit_cost = line_cost

            total_amount += subtotal
            total_cost += line_cost * line_data.quantity

        sale.total_amount = total_amount
        sale.total_cost = total_cost
        sale.profit = total_amount - total_cost

        await self.session.commit()

        return await self.get_sale(sale.id)

    async def _resolve_customer(
        self,
        customer_id: UUID | None,
    ) -> Customer:
        if customer_id is not None:
            customer = await self.customer_repository.get_by_id(customer_id)

            if customer is None:
                raise NotFoundException("Customer not found.")

            if not customer.is_active:
                raise BadRequestException("Customer is not active.")

            return customer

        customer = await self.customer_repository.get_default()

        if customer is None:
            raise BadRequestException(
                "No customer_id was provided and no default customer is "
                "configured."
            )

        return customer

    async def _validate_lines(
        self,
        data: SaleCreate,
    ) -> dict[UUID, Product]:
        products: dict[UUID, Product] = {}
        seen_identifiers: set[str] = set()
        requested_quantities: dict[UUID, int] = {}

        for line in data.lines:
            product = products.get(line.product_id)

            if product is None:
                product = await self.product_repository.get_by_id(
                    line.product_id
                )

                if product is None:
                    raise NotFoundException(
                        f"Product {line.product_id} not found."
                    )

                if not product.is_active:
                    raise BadRequestException(
                        f"Product {line.product_id} is not active."
                    )

                products[line.product_id] = product

            if product.tracking_type == TrackingType.SERIAL:
                if line.quantity != 1:
                    raise BadRequestException(
                        "Serial-tracked lines must have quantity=1."
                    )

                if not line.imei:
                    raise BadRequestException(
                        "imei is required for serial-tracked lines."
                    )

                if line.imei in seen_identifiers:
                    raise ConflictException(
                        f"IMEI {line.imei} is duplicated in this sale."
                    )

                seen_identifiers.add(line.imei)

                unit = await self.inventory_service.get_unit_by_imei(
                    line.imei
                )

                if unit.product_id != product.id:
                    raise NotFoundException(
                        f"IMEI {line.imei} does not belong to product "
                        f"{product.id}."
                    )

                if unit.status == ProductUnitStatus.SOLD:
                    raise ConflictException(
                        f"IMEI {line.imei} already sold."
                    )

                if unit.status != ProductUnitStatus.IN_STOCK:
                    raise BadRequestException(
                        f"IMEI {line.imei} is not available for sale."
                    )
            else:
                if line.imei:
                    raise BadRequestException(
                        "imei is only valid for serial-tracked lines."
                    )

                requested_quantities[line.product_id] = (
                    requested_quantities.get(line.product_id, 0)
                    + line.quantity
                )

        for product_id, total_quantity in requested_quantities.items():
            available = await self.inventory_service.get_available_stock(
                product_id
            )

            if available.available_quantity < total_quantity:
                raise BadRequestException(
                    f"Insufficient stock for product {product_id}."
                )

        return products
