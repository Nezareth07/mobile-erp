from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.purchase.schemas.purchase_line_create import PurchaseLineCreate


class PurchaseCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_id: UUID

    location_id: UUID | None = None

    invoice_number: str | None = Field(
        default=None,
        max_length=50,
    )

    purchase_date: datetime | None = None

    notes: str | None = Field(
        default=None,
        max_length=500,
    )

    lines: list[PurchaseLineCreate] = Field(
        min_length=1,
    )
