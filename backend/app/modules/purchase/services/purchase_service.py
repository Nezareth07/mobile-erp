from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.schemas.batch_intake_create import BatchIntakeCreate
from app.modules.inventory.schemas.serial_intake_create import SerialIntakeCreate
from app.modules.inventory.services.inventory_service import InventoryService
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.product import Product
from app.modules.product.repositories.product_repository import ProductRepository
from app.modules.product.schemas.product_summary import ProductSummary
from app.modules.purchase.enums.purchase_status import PurchaseStatus
from app.modules.purchase.models.purchase import Purchase
from app.modules.purchase.models.purchase_line import PurchaseLine
from app.modules.purchase.repositories.purchase_line_repository import (
    PurchaseLineRepository,
)
from app.modules.purchase.repositories.purchase_repository import (
    PurchaseRepository,
)
from app.modules.purchase.schemas.daily_purchases_point import (
    DailyPurchasesPoint,
)
from app.modules.purchase.schemas.purchase_create import PurchaseCreate
from app.modules.purchase.schemas.purchases_summary import PurchasesSummary
from app.modules.purchase.schemas.top_purchased_product import (
    TopPurchasedProduct,
)
from app.modules.purchase.schemas.top_supplier import TopSupplier
from app.modules.supplier.repositories.supplier_repository import (
    SupplierRepository,
)
from app.modules.supplier.schemas.supplier_summary import SupplierSummary


class PurchaseService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session

        self.purchase_repository = PurchaseRepository(session)
        self.purchase_line_repository = PurchaseLineRepository(session)
        self.supplier_repository = SupplierRepository(session)
        self.product_repository = ProductRepository(session)
        self.inventory_service = InventoryService(session)

    async def get_purchase(
        self,
        purchase_id: UUID,
    ) -> Purchase:
        purchase = await self.purchase_repository.get_by_id(purchase_id)

        if purchase is None:
            raise NotFoundException("Purchase not found.")

        return purchase

    async def get_purchases(
        self,
        supplier_id: UUID | None,
        limit: int,
        offset: int,
    ) -> list[Purchase]:
        return await self.purchase_repository.list_paginated(
            supplier_id,
            limit,
            offset,
        )

    async def create_purchase(
        self,
        data: PurchaseCreate,
    ) -> Purchase:
        supplier = await self.supplier_repository.get_by_id(data.supplier_id)

        if supplier is None:
            raise NotFoundException("Supplier not found.")

        if not supplier.is_active:
            raise BadRequestException("Supplier is not active.")

        location = await self.inventory_service.resolve_location(
            data.location_id
        )

        products = await self._validate_lines(data)

        total_cost = sum(
            line.quantity * line.unit_cost for line in data.lines
        )

        purchase = Purchase(
            supplier_id=supplier.id,
            location_id=location.id,
            status=PurchaseStatus.CONFIRMED,
            invoice_number=data.invoice_number,
            purchase_date=data.purchase_date or datetime.now(timezone.utc),
            total_cost=total_cost,
            notes=data.notes,
        )

        await self.purchase_repository.create(purchase)
        await self.session.flush()

        for line_data in data.lines:
            product = products[line_data.product_id]
            subtotal = line_data.quantity * line_data.unit_cost

            purchase_line = PurchaseLine(
                purchase_id=purchase.id,
                product_id=product.id,
                quantity=line_data.quantity,
                unit_cost=line_data.unit_cost,
                subtotal=subtotal,
                imei=line_data.imei,
                imei2=line_data.imei2,
                lot_code=line_data.lot_code,
            )

            await self.purchase_line_repository.create(purchase_line)
            await self.session.flush()

            if product.tracking_type == TrackingType.SERIAL:
                await self.inventory_service.register_serial_intake(
                    SerialIntakeCreate(
                        product_id=product.id,
                        imei=line_data.imei,
                        imei2=line_data.imei2,
                        unit_cost=line_data.unit_cost,
                        location_id=location.id,
                        source_type=MovementSourceType.PURCHASE,
                        source_reference=str(purchase.id),
                    ),
                    purchase_line_id=purchase_line.id,
                )
            else:
                await self.inventory_service.register_batch_intake(
                    BatchIntakeCreate(
                        product_id=product.id,
                        lot_code=line_data.lot_code,
                        quantity=line_data.quantity,
                        unit_cost=line_data.unit_cost,
                        location_id=location.id,
                        source_type=MovementSourceType.PURCHASE,
                        source_reference=str(purchase.id),
                    ),
                    purchase_line_id=purchase_line.id,
                )

            product.cost_price = line_data.unit_cost

        await self.session.commit()

        return await self.get_purchase(purchase.id)

    async def _validate_lines(
        self,
        data: PurchaseCreate,
    ) -> dict[UUID, Product]:
        products: dict[UUID, Product] = {}
        seen_identifiers: set[str] = set()

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

                for identifier in (line.imei, line.imei2):
                    if not identifier:
                        continue

                    if identifier in seen_identifiers:
                        raise ConflictException(
                            f"IMEI {identifier} is duplicated in this "
                            "purchase."
                        )

                    seen_identifiers.add(identifier)

                    if await self.inventory_service.imei_exists(identifier):
                        raise ConflictException(
                            f"IMEI {identifier} already registered."
                        )
            else:
                if line.imei or line.imei2:
                    raise BadRequestException(
                        "imei is only valid for serial-tracked lines."
                    )

        return products

    async def get_purchases_summary(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
    ) -> PurchasesSummary:
        self._validate_date_range(date_from, date_to)

        if location_id is not None:
            await self.inventory_service.resolve_location(location_id)

        count, total_cost = await self.purchase_repository.get_summary(
            date_from, date_to, location_id
        )

        return PurchasesSummary(
            purchases_count=count,
            total_cost=total_cost,
        )

    async def get_daily_purchases_overview(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
    ) -> list[DailyPurchasesPoint]:
        self._validate_date_range(date_from, date_to)

        if location_id is not None:
            await self.inventory_service.resolve_location(location_id)

        rows = await self.purchase_repository.get_daily_series(
            date_from, date_to, location_id
        )

        return [
            DailyPurchasesPoint(
                date=day.date(),
                purchases_count=count,
                total_cost=total_cost,
            )
            for day, count, total_cost in rows
        ]

    async def get_top_suppliers(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
        limit: int,
    ) -> list[TopSupplier]:
        self._validate_date_range(date_from, date_to)

        if location_id is not None:
            await self.inventory_service.resolve_location(location_id)

        rows = await self.purchase_repository.get_top_suppliers(
            date_from, date_to, location_id, limit
        )

        return [
            TopSupplier(
                supplier=SupplierSummary.model_validate(supplier),
                purchases_count=count,
                total_cost=total_cost,
            )
            for supplier, count, total_cost in rows
        ]

    async def get_top_purchased_products(
        self,
        date_from: datetime,
        date_to: datetime,
        location_id: UUID | None,
        limit: int,
        order_by: str = "cost",
    ) -> list[TopPurchasedProduct]:
        self._validate_date_range(date_from, date_to)

        if order_by not in ("cost", "quantity"):
            raise BadRequestException(
                "order_by must be 'cost' or 'quantity'."
            )

        if location_id is not None:
            await self.inventory_service.resolve_location(location_id)

        rows = await self.purchase_line_repository.get_top_products(
            date_from,
            date_to,
            location_id,
            limit,
            order_by == "quantity",
        )

        return [
            TopPurchasedProduct(
                product=ProductSummary.model_validate(product),
                quantity_purchased=quantity_purchased,
                total_cost=total_cost,
            )
            for product, quantity_purchased, total_cost in rows
        ]

    @staticmethod
    def _validate_date_range(
        date_from: datetime,
        date_to: datetime,
    ) -> None:
        if date_from >= date_to:
            raise BadRequestException(
                "date_from must be strictly before date_to."
            )
