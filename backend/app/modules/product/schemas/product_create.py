from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.product.enums.tracking_type import TrackingType


class ProductCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(
        min_length=2,
        max_length=150,
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )

    sku: str = Field(
        min_length=1,
        max_length=50,
    )

    brand_id: UUID

    category_id: UUID

    tracking_type: TrackingType

    cost_price: Decimal = Field(
        ge=0,
    )

    sale_price: Decimal = Field(
        ge=0,
    )