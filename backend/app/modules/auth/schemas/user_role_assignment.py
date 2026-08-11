from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserRoleAssignment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_ids: list[UUID] = Field(
        default_factory=list,
    )
