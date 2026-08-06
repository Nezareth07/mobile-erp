from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin
from app.modules.inventory.enums.location_type import LocationType


class Location(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "location"

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    type: Mapped[LocationType] = mapped_column(
        Enum(LocationType),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )
