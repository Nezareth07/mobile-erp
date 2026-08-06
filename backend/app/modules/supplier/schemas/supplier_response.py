from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    tax_id: str | None
    contact_name: str | None
    phone: str | None
    email: str | None
    address: str | None
    notes: str | None
    is_active: bool

    created_at: datetime
    updated_at: datetime
