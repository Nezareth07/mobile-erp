from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.auth.schemas.role_summary import RoleSummary


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    is_active: bool
    roles: list[RoleSummary]

    created_at: datetime
    updated_at: datetime
