from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.schemas.location_summary import LocationSummary


class StockLotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    lot_code: str | None
    quantity_received: int
    quantity_available: int
    unit_cost: Decimal
    location: LocationSummary

    received_at: datetime
