from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PurchasesSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    purchases_count: int
    total_cost: Decimal
