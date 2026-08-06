from pydantic import BaseModel, ConfigDict, Field


class CategoryUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100,
    )