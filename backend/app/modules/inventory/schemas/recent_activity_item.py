from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.enums.movement_type import MovementType
from app.modules.inventory.schemas.location_summary import LocationSummary
from app.modules.product.schemas.product_summary import ProductSummary


class RecentActivityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product: ProductSummary
    movement_type: MovementType
    quantity: int | None
    unit_cost: Decimal
    location: LocationSummary
    source_type: MovementSourceType
    source_reference: str | None
    notes: str | None
    created_at: datetime
