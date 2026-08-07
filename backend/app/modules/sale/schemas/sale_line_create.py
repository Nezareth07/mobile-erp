from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SaleLineCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID

    quantity: int = Field(
        gt=0,
    )

    unit_price: Decimal | None = Field(
        default=None,
        ge=0,
    )

    imei: str | None = Field(
        default=None,
        max_length=15,
    )
