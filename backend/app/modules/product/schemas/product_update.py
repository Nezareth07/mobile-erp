from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.product.enums.tracking_type import TrackingType


class ProductUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )

    sku: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )

    brand_id: UUID | None = None

    category_id: UUID | None = None

    tracking_type: TrackingType | None = None

    cost_price: Decimal | None = Field(
        default=None,
        ge=0,
    )

    sale_price: Decimal | None = Field(
        default=None,
        ge=0,
    )