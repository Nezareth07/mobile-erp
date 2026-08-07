from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.sale.schemas.sale_line_create import SaleLineCreate


class SaleCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: UUID | None = None

    location_id: UUID | None = None

    sale_date: datetime | None = None

    notes: str | None = Field(
        default=None,
        max_length=500,
    )

    lines: list[SaleLineCreate] = Field(
        min_length=1,
    )
