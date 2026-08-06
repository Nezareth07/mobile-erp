from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupplierSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
