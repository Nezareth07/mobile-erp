from decimal import Decimal
import uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin
from app.modules.inventory.enums.product_unit_status import ProductUnitStatus


class ProductUnit(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "product_unit"

    __table_args__ = (
        CheckConstraint(
            "unit_cost >= 0",
            name="unit_cost_positive",
        ),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product.id"),
        nullable=False,
        index=True,
    )

    imei: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
        unique=True,
        index=True,
    )

    imei2: Mapped[str | None] = mapped_column(
        String(15),
        nullable=True,
        unique=True,
        index=True,
    )

    status: Mapped[ProductUnitStatus] = mapped_column(
        Enum(ProductUnitStatus),
        nullable=False,
        default=ProductUnitStatus.IN_STOCK,
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("location.id"),
        nullable=False,
        index=True,
    )

    location: Mapped["Location"] = relationship()

    purchase_line_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("purchase_line.id"),
        nullable=True,
        index=True,
    )
