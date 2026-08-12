from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.product.schemas.product_summary import ProductSummary


class TopPurchasedProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product: ProductSummary
    quantity_purchased: int
    total_cost: Decimal
