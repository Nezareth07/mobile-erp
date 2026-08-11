from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.auth.schemas.permission_summary import PermissionSummary


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_active: bool
    permissions: list[PermissionSummary]

    created_at: datetime
    updated_at: datetime
