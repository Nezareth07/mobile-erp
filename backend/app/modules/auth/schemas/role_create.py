from pydantic import BaseModel, ConfigDict, Field


class RoleCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(
        min_length=2,
        max_length=50,
    )

    description: str | None = Field(
        default=None,
        max_length=255,
    )
