from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.modules.inventory.enums.location_type import LocationType


class LocationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    type: LocationType
