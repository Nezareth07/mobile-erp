from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.schemas.product_summary import ProductSummary


class StockValuationLine(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product: ProductSummary
    tracking_type: TrackingType
    quantity_on_hand: int
    total_value: Decimal
