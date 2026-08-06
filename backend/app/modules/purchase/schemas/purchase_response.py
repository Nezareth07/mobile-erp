from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.schemas.location_summary import LocationSummary
from app.modules.purchase.enums.purchase_status import PurchaseStatus
from app.modules.purchase.schemas.purchase_line_response import (
    PurchaseLineResponse,
)
from app.modules.supplier.schemas.supplier_summary import SupplierSummary


class PurchaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    supplier: SupplierSummary
    location: LocationSummary
    status: PurchaseStatus
    invoice_number: str | None
    purchase_date: datetime
    total_cost: Decimal
    notes: str | None
    lines: list[PurchaseLineResponse]

    created_at: datetime
    updated_at: datetime
