from uuid import UUID

from pydantic import BaseModel

from app.modules.product.enums.tracking_type import TrackingType


class AvailableStockResponse(BaseModel):
    product_id: UUID
    tracking_type: TrackingType
    available_quantity: int
