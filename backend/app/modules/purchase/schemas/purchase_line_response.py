from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.product.schemas.product_summary import ProductSummary


class PurchaseLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product: ProductSummary
    quantity: int
    unit_cost: Decimal
    subtotal: Decimal
    imei: str | None
    imei2: str | None
    lot_code: str | None
