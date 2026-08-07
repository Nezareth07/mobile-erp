from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.customer.schemas.customer_summary import CustomerSummary
from app.modules.inventory.schemas.location_summary import LocationSummary
from app.modules.sale.enums.sale_status import SaleStatus
from app.modules.sale.schemas.sale_line_response import SaleLineResponse


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer: CustomerSummary
    location: LocationSummary
    status: SaleStatus
    sale_date: datetime
    total_amount: Decimal
    total_cost: Decimal
    profit: Decimal
    notes: str | None
    lines: list[SaleLineResponse]

    created_at: datetime
    updated_at: datetime
