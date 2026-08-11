from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin


class Role(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "role"

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )

    users: Mapped[list["User"]] = relationship(
        secondary="user_role",
        back_populates="roles",
    )

    permissions: Mapped[list["Permission"]] = relationship(
        secondary="role_permission",
        back_populates="roles",
    )
