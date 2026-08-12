from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DailyPurchasesPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    purchases_count: int
    total_cost: Decimal
