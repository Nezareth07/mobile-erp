from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    document_id: str | None
    phone: str | None
    email: str | None
    address: str | None
    notes: str | None
    is_active: bool
    is_default_customer: bool

    created_at: datetime
    updated_at: datetime
