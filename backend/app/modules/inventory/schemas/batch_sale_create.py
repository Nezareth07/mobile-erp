from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BatchSaleCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID

    quantity: int = Field(
        gt=0,
    )

    location_id: UUID | None = None

    source_reference: str | None = Field(
        default=None,
        max_length=100,
    )

    notes: str | None = Field(
        default=None,
        max_length=500,
    )
