from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.enums.movement_type import MovementType


class StockMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    movement_type: MovementType
    product_unit_id: UUID | None
    stock_lot_id: UUID | None
    quantity: int | None
    unit_cost: Decimal
    location_id: UUID
    source_type: MovementSourceType
    source_reference: str | None
    notes: str | None

    created_at: datetime
