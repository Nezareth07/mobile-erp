from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.product.schemas.product_summary import ProductSummary


class SaleLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product: ProductSummary
    quantity: int
    unit_price: Decimal
    unit_cost: Decimal
    subtotal: Decimal
    imei: str | None
