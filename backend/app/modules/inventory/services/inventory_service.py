from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.modules.inventory.enums.adjustment_direction import AdjustmentDirection
from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.enums.movement_type import MovementType
from app.modules.inventory.enums.product_unit_status import ProductUnitStatus
from app.modules.inventory.models.location import Location
from app.modules.inventory.models.product_unit import ProductUnit
from app.modules.inventory.models.stock_lot import StockLot
from app.modules.inventory.models.stock_movement import StockMovement
from app.modules.inventory.repositories.product_unit_repository import (
    ProductUnitRepository,
)
from app.modules.inventory.repositories.stock_lot_repository import (
    StockLotRepository,
)
from app.modules.inventory.repositories.stock_movement_repository import (
    StockMovementRepository,
)
from app.modules.inventory.schemas.available_stock_response import (
    AvailableStockResponse,
)
from app.modules.inventory.schemas.batch_intake_create import BatchIntakeCreate
from app.modules.inventory.schemas.batch_sale_create import BatchSaleCreate
from app.modules.inventory.schemas.serial_intake_create import SerialIntakeCreate
from app.modules.inventory.schemas.serial_sale_create import SerialSaleCreate
from app.modules.inventory.schemas.stock_adjustment_create import (
    StockAdjustmentCreate,
)
from app.modules.inventory.schemas.stock_valuation_line import (
    StockValuationLine,
)
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.product import Product
from app.modules.product.repositories.product_repository import ProductRepository
from app.modules.product.schemas.product_summary import ProductSummary


# Maps a movement's source into the concrete ledger entry for each direction.
# SALE as an inbound source represents a customer return; PURCHASE as an
# outbound source represents stock sent back to a supplier.
_INBOUND_MOVEMENT_TYPE = {
    MovementSourceType.MANUAL: MovementType.ADJUSTMENT_IN,
    MovementSourceType.PURCHASE: MovementType.PURCHASE_IN,
    MovementSourceType.WARRANTY: MovementType.WARRANTY_IN,
    MovementSourceType.TRANSFER: MovementType.TRANSFER_IN,
    MovementSourceType.SALE: MovementType.RETURN_IN,
}

_OUTBOUND_MOVEMENT_TYPE = {
    MovementSourceType.MANUAL: MovementType.ADJUSTMENT_OUT,
    MovementSourceType.PURCHASE: MovementType.RETURN_OUT,
    MovementSourceType.WARRANTY: MovementType.WARRANTY_OUT,
    MovementSourceType.TRANSFER: MovementType.TRANSFER_OUT,
    MovementSourceType.SALE: MovementType.SALE_OUT,
}


class InventoryService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session

        self.product_repository = ProductRepository(session)
        self.product_unit_repository = ProductUnitRepository(session)
        self.stock_lot_repository = StockLotRepository(session)
        self.stock_movement_repository = StockMovementRepository(session)

    async def _get_product(
        self,
        product_id: UUID,
    ) -> Product:
        product = await self.product_repository.get_by_id(product_id)

        if product is None:
            raise NotFoundException("Product not found.")

        return product

    async def resolve_location(
        self,
        location_id: UUID | None,
    ) -> Location:
        if location_id is not None:
            location = await self.session.get(Location, location_id)

            if location is None:
                raise NotFoundException("Location not found.")

            return location

        query = (
            select(Location)
            .where(Location.is_active.is_(True))
            .order_by(Location.created_at)
            .limit(1)
        )

        result = await self.session.execute(query)
        location = result.scalar_one_or_none()

        if location is None:
            raise NotFoundException("No active location configured.")

        return location

    async def register_serial_intake(
        self,
        data: SerialIntakeCreate,
        purchase_line_id: UUID | None = None,
    ) -> ProductUnit:
        product = await self._get_product(data.product_id)

        if product.tracking_type != TrackingType.SERIAL:
            raise BadRequestException(
                "Product is not serial-tracked."
            )

        if await self.product_unit_repository.imei_exists(data.imei):
            raise ConflictException("IMEI already registered.")

        if data.imei2 and await self.product_unit_repository.imei_exists(
            data.imei2
        ):
            raise ConflictException("IMEI already registered.")

        location = await self.resolve_location(data.location_id)

        unit = ProductUnit(
            product_id=product.id,
            imei=data.imei,
            imei2=data.imei2,
            unit_cost=data.unit_cost,
            location_id=location.id,
            purchase_line_id=purchase_line_id,
        )

        await self.product_unit_repository.create(unit)
        await self.session.flush()

        movement = StockMovement(
            product_id=product.id,
            movement_type=_INBOUND_MOVEMENT_TYPE[data.source_type],
            product_unit_id=unit.id,
            unit_cost=data.unit_cost,
            location_id=location.id,
            source_type=data.source_type,
            source_reference=data.source_reference,
            notes=data.notes,
        )

        await self.stock_movement_repository.create(movement)
        await self.session.flush()

        return await self.product_unit_repository.get_by_imei(data.imei)

    async def register_batch_intake(
        self,
        data: BatchIntakeCreate,
        purchase_line_id: UUID | None = None,
    ) -> StockLot:
        product = await self._get_product(data.product_id)

        if product.tracking_type == TrackingType.SERIAL:
            raise BadRequestException(
                "Product is serial-tracked; use serial intake instead."
            )

        location = await self.resolve_location(data.location_id)

        lot = StockLot(
            product_id=product.id,
            lot_code=data.lot_code,
            quantity_received=data.quantity,
            quantity_available=data.quantity,
            unit_cost=data.unit_cost,
            location_id=location.id,
            purchase_line_id=purchase_line_id,
        )

        await self.stock_lot_repository.create(lot)
        await self.session.flush()

        movement = StockMovement(
            product_id=product.id,
            movement_type=_INBOUND_MOVEMENT_TYPE[data.source_type],
            stock_lot_id=lot.id,
            quantity=data.quantity,
            unit_cost=data.unit_cost,
            location_id=location.id,
            source_type=data.source_type,
            source_reference=data.source_reference,
            notes=data.notes,
        )

        await self.stock_movement_repository.create(movement)
        await self.session.flush()

        return await self.stock_lot_repository.get_by_id(lot.id)

    async def register_serial_sale(
        self,
        data: SerialSaleCreate,
        sale_line_id: UUID,
    ) -> ProductUnit:
        product = await self._get_product(data.product_id)

        if product.tracking_type != TrackingType.SERIAL:
            raise BadRequestException("Product is not serial-tracked.")

        unit = await self.product_unit_repository.get_by_imei(data.imei)

        if unit is None or unit.product_id != product.id:
            raise NotFoundException(
                f"IMEI {data.imei} not found for this product."
            )

        locked_unit = await self.product_unit_repository.get_for_update(
            unit.id
        )

        if locked_unit.status == ProductUnitStatus.SOLD:
            raise ConflictException(f"IMEI {data.imei} already sold.")

        if locked_unit.status != ProductUnitStatus.IN_STOCK:
            raise BadRequestException(
                f"IMEI {data.imei} is not available for sale."
            )

        locked_unit.status = ProductUnitStatus.SOLD
        locked_unit.sale_line_id = sale_line_id

        movement = StockMovement(
            product_id=product.id,
            movement_type=MovementType.SALE_OUT,
            product_unit_id=locked_unit.id,
            unit_cost=locked_unit.unit_cost,
            location_id=data.location_id or locked_unit.location_id,
            source_type=MovementSourceType.SALE,
            source_reference=data.source_reference,
            notes=data.notes,
        )

        await self.stock_movement_repository.create(movement)
        await self.session.flush()

        return locked_unit

    async def register_batch_sale(
        self,
        data: BatchSaleCreate,
    ) -> Decimal:
        """Consumes stock FIFO across one or more lots; returns the
        weighted-average unit cost of the stock actually consumed."""
        product = await self._get_product(data.product_id)

        if product.tracking_type == TrackingType.SERIAL:
            raise BadRequestException(
                "Product is serial-tracked; use serial sale instead."
            )

        lots = await self.stock_lot_repository.list_by_product(product.id)

        remaining = data.quantity
        total_cost = Decimal("0")

        for lot in lots:
            if remaining <= 0:
                break

            if lot.quantity_available <= 0:
                continue

            locked_lot = await self.stock_lot_repository.get_for_update(
                lot.id
            )

            if locked_lot.quantity_available <= 0:
                continue

            consumed = min(locked_lot.quantity_available, remaining)

            locked_lot.quantity_available -= consumed
            remaining -= consumed
            total_cost += consumed * locked_lot.unit_cost

            movement = StockMovement(
                product_id=product.id,
                movement_type=MovementType.SALE_OUT,
                stock_lot_id=locked_lot.id,
                quantity=consumed,
                unit_cost=locked_lot.unit_cost,
                location_id=data.location_id or locked_lot.location_id,
                source_type=MovementSourceType.SALE,
                source_reference=data.source_reference,
                notes=data.notes,
            )

            await self.stock_movement_repository.create(movement)

        if remaining > 0:
            raise BadRequestException(
                "Not enough available stock to complete this sale."
            )

        await self.session.flush()

        return total_cost / data.quantity

    async def get_available_stock(
        self,
        product_id: UUID,
    ) -> AvailableStockResponse:
        product = await self._get_product(product_id)

        if product.tracking_type == TrackingType.SERIAL:
            quantity = await self.product_unit_repository.count_available_by_product(
                product.id
            )
        else:
            quantity = await self.stock_lot_repository.sum_available_by_product(
                product.id
            )

        return AvailableStockResponse(
            product_id=product.id,
            tracking_type=product.tracking_type,
            available_quantity=quantity,
        )

    async def list_units(
        self,
        product_id: UUID,
        status: ProductUnitStatus | None = None,
    ) -> list[ProductUnit]:
        product = await self._get_product(product_id)

        if product.tracking_type != TrackingType.SERIAL:
            raise BadRequestException(
                "Product is not serial-tracked."
            )

        return await self.product_unit_repository.list_by_product(
            product.id,
            status,
        )

    async def get_unit_by_imei(
        self,
        imei: str,
    ) -> ProductUnit:
        unit = await self.product_unit_repository.get_by_imei(imei)

        if unit is None:
            raise NotFoundException("Product unit not found.")

        return unit

    async def imei_exists(
        self,
        imei: str,
    ) -> bool:
        return await self.product_unit_repository.imei_exists(imei)

    async def adjust_stock(
        self,
        data: StockAdjustmentCreate,
    ) -> AvailableStockResponse:
        product = await self._get_product(data.product_id)

        if product.tracking_type == TrackingType.SERIAL:
            await self._adjust_serial_unit(product, data)
        else:
            await self._adjust_lot_quantity(product, data)

        return await self.get_available_stock(product.id)

    async def _adjust_serial_unit(
        self,
        product: Product,
        data: StockAdjustmentCreate,
    ) -> None:
        if not data.imei:
            raise BadRequestException(
                "imei is required to adjust a serial-tracked product."
            )

        if data.new_status is None:
            raise BadRequestException(
                "new_status is required to adjust a serial-tracked unit."
            )

        unit = await self.product_unit_repository.get_by_imei(data.imei)

        if unit is None or unit.product_id != product.id:
            raise NotFoundException("Product unit not found.")

        was_available = unit.status == ProductUnitStatus.IN_STOCK
        unit.status = data.new_status
        is_available_now = unit.status == ProductUnitStatus.IN_STOCK

        if was_available == is_available_now:
            raise BadRequestException(
                "Adjustment does not change unit availability."
            )

        movement = StockMovement(
            product_id=product.id,
            movement_type=(
                MovementType.ADJUSTMENT_IN
                if is_available_now
                else MovementType.ADJUSTMENT_OUT
            ),
            product_unit_id=unit.id,
            unit_cost=unit.unit_cost,
            location_id=data.location_id or unit.location_id,
            source_type=MovementSourceType.MANUAL,
            notes=data.notes,
        )

        await self.stock_movement_repository.create(movement)

    async def _adjust_lot_quantity(
        self,
        product: Product,
        data: StockAdjustmentCreate,
    ) -> None:
        if not data.quantity:
            raise BadRequestException(
                "quantity is required to adjust a batch/untracked product."
            )

        if data.direction == AdjustmentDirection.IN:
            if data.unit_cost is None:
                raise BadRequestException(
                    "unit_cost is required for inbound adjustments."
                )

            location = await self.resolve_location(data.location_id)

            lot = StockLot(
                product_id=product.id,
                lot_code=None,
                quantity_received=data.quantity,
                quantity_available=data.quantity,
                unit_cost=data.unit_cost,
                location_id=location.id,
            )

            await self.stock_lot_repository.create(lot)
            await self.session.flush()

            movement = StockMovement(
                product_id=product.id,
                movement_type=MovementType.ADJUSTMENT_IN,
                stock_lot_id=lot.id,
                quantity=data.quantity,
                unit_cost=data.unit_cost,
                location_id=location.id,
                source_type=MovementSourceType.MANUAL,
                notes=data.notes,
            )

            await self.stock_movement_repository.create(movement)

            return

        lots = await self.stock_lot_repository.list_by_product(product.id)
        target_lot = next(
            (lot for lot in lots if lot.quantity_available > 0),
            None,
        )

        if target_lot is None:
            raise BadRequestException("No available stock to adjust.")

        locked_lot = await self.stock_lot_repository.get_for_update(
            target_lot.id
        )

        if locked_lot.quantity_available < data.quantity:
            raise BadRequestException(
                "Not enough available stock in the earliest lot for this "
                "adjustment."
            )

        locked_lot.quantity_available -= data.quantity

        movement = StockMovement(
            product_id=product.id,
            movement_type=MovementType.ADJUSTMENT_OUT,
            stock_lot_id=locked_lot.id,
            quantity=data.quantity,
            unit_cost=locked_lot.unit_cost,
            location_id=data.location_id or locked_lot.location_id,
            source_type=MovementSourceType.MANUAL,
            notes=data.notes,
        )

        await self.stock_movement_repository.create(movement)

    async def get_recent_movements(
        self,
        limit: int,
        location_id: UUID | None,
    ) -> list[StockMovement]:
        if location_id is not None:
            await self.resolve_location(location_id)

        return await self.stock_movement_repository.list_recent(
            limit, location_id
        )

    async def get_stock_valuation(
        self,
        location_id: UUID | None,
    ) -> list[StockValuationLine]:
        """Foto del valor de stock actual -- SERIAL cuenta unicamente
        ProductUnit.IN_STOCK, BATCH/NONE usa unicamente
        StockLot.quantity_available. Nunca quantity_received (eso es lo
        recibido historicamente, no lo que queda). Un producto solo
        aparece en una de las dos consultas segun su tracking_type, nunca
        en ambas, por lo que no hay conflicto al concatenar resultados."""
        if location_id is not None:
            await self.resolve_location(location_id)

        serial_rows = await self.product_unit_repository.get_valuation_by_product(
            location_id
        )
        batch_rows = await self.stock_lot_repository.get_valuation_by_product(
            location_id
        )

        lines = [
            StockValuationLine(
                product=ProductSummary.model_validate(product),
                tracking_type=product.tracking_type,
                quantity_on_hand=quantity_on_hand,
                total_value=total_value,
            )
            for product, quantity_on_hand, total_value in (
                *serial_rows,
                *batch_rows,
            )
        ]

        return sorted(lines, key=lambda line: line.product.name)

    async def get_movements_report(
        self,
        date_from: datetime,
        date_to: datetime,
        product_id: UUID | None,
        location_id: UUID | None,
        movement_type: MovementType | None,
        limit: int,
        offset: int,
    ) -> list[StockMovement]:
        if date_from >= date_to:
            raise BadRequestException(
                "date_from must be strictly before date_to."
            )

        if location_id is not None:
            await self.resolve_location(location_id)

        if product_id is not None:
            await self._get_product(product_id)

        return await self.stock_movement_repository.list_filtered(
            date_from,
            date_to,
            product_id,
            location_id,
            movement_type,
            limit,
            offset,
        )
