from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(
        min_length=2,
        max_length=100,
    )