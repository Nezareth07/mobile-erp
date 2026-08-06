from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.enums.product_unit_status import ProductUnitStatus
from app.modules.inventory.schemas.location_summary import LocationSummary


class ProductUnitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    imei: str
    imei2: str | None
    status: ProductUnitStatus
    unit_cost: Decimal
    location: LocationSummary

    created_at: datetime
    updated_at: datetime
