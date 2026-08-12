from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SalesSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sales_count: int
    total_amount: Decimal
    total_cost: Decimal
    total_profit: Decimal
