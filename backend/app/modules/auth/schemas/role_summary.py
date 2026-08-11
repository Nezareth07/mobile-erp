from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RoleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
