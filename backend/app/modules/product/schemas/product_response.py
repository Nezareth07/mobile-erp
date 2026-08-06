from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.schemas.brand_summary import BrandSummary
from app.modules.product.schemas.category_summary import CategorySummary


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID

    name: str

    description: str | None

    sku: str

    tracking_type: TrackingType

    cost_price: Decimal

    sale_price: Decimal

    is_active: bool

    brand: BrandSummary

    category: CategorySummary

    created_at: datetime

    updated_at: datetime