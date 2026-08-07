from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SerialSaleCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: UUID

    imei: str = Field(
        min_length=1,
        max_length=15,
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
