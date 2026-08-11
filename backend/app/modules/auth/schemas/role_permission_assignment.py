from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RolePermissionAssignment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    permission_ids: list[UUID] = Field(
        default_factory=list,
    )
