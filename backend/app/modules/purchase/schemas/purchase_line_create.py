from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PurchaseLineCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID

    quantity: int = Field(
        gt=0,
    )

    unit_cost: Decimal = Field(
        ge=0,
    )

    imei: str | None = Field(
        default=None,
        max_length=15,
    )

    imei2: str | None = Field(
        default=None,
        max_length=15,
    )

    lot_code: str | None = Field(
        default=None,
        max_length=50,
    )
