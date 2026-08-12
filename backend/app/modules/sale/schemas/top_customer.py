from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.customer.schemas.customer_summary import CustomerSummary


class TopCustomer(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer: CustomerSummary
    sales_count: int
    revenue: Decimal
