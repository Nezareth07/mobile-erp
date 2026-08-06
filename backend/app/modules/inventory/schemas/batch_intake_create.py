from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.inventory.enums.movement_source_type import MovementSourceType


class BatchIntakeCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID

    lot_code: str | None = Field(
        default=None,
        max_length=50,
    )

    quantity: int = Field(
        gt=0,
    )

    unit_cost: Decimal = Field(
        ge=0,
    )

    location_id: UUID | None = None

    source_type: MovementSourceType = MovementSourceType.MANUAL

    source_reference: str | None = Field(
        default=None,
        max_length=100,
    )

    notes: str | None = Field(
        default=None,
        max_length=500,
    )
