from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class DailySalesPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    sales_count: int
    revenue: Decimal
    cost: Decimal
    profit: Decimal
