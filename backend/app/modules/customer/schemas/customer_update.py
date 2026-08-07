from pydantic import BaseModel, ConfigDict, Field


class CustomerUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    document_id: str | None = Field(
        default=None,
        max_length=20,
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
