from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.inventory.enums.adjustment_direction import AdjustmentDirection
from app.modules.inventory.enums.product_unit_status import ProductUnitStatus


class StockAdjustmentCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID

    direction: AdjustmentDirection

    # SERIAL products: identifies the existing unit being adjusted.
    imei: str | None = Field(
        default=None,
        max_length=15,
    )

    # SERIAL products: target status the unit moves to (e.g. DEFECTIVE for
    # an OUT adjustment, IN_STOCK for an IN adjustment).
    new_status: ProductUnitStatus | None = None

    # BATCH/NONE products: magnitude of the correction.
    quantity: int | None = Field(
        default=None,
        gt=0,
    )

    # Required for IN adjustments that introduce new countable stock
    # (BATCH/NONE without an existing lot to draw the cost from).
    unit_cost: Decimal | None = Field(
        default=None,
        ge=0,
    )

    location_id: UUID | None = None

    notes: str | None = Field(
        default=None,
        max_length=500,
    )
