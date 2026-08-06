from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin


class Brand(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "brand"

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )

    products: Mapped[list["Product"]] = relationship(
        back_populates="brand",
    )