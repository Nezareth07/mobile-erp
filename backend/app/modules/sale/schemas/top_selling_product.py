from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.product.schemas.product_summary import ProductSummary


class TopSellingProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product: ProductSummary
    quantity_sold: int
    revenue: Decimal
