from pydantic import BaseModel, ConfigDict, Field


class SupplierCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(
        min_length=2,
        max_length=150,
    )

    tax_id: str | None = Field(
        default=None,
        max_length=20,
    )

    contact_name: str | None = Field(
        default=None,
        max_length=100,
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    email: str | None = Field(
        default=None,
        max_length=255,
    )

    address: str | None = Field(
        default=None,
        max_length=255,
    )

    notes: str | None = Field(
        default=None,
        max_length=500,
    )
