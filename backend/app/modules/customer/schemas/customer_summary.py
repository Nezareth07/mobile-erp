from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CustomerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
