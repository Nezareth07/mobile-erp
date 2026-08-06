from decimal import Decimal
import uuid

from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin
from app.modules.product.enums.tracking_type import TrackingType


class Product(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "product"

    __table_args__ = (
        CheckConstraint(
            "cost_price >= 0",
            name="cost_price_positive",
        ),
        CheckConstraint(
            "sale_price >= 0",
            name="sale_price_positive",
        ),
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    sku: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    brand_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("brand.id"),
        nullable=False,
        index=True,
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("category.id"),
        nullable=False,
        index=True,
    )

    tracking_type: Mapped[TrackingType] = mapped_column(
        Enum(TrackingType),
        nullable=False,
    )

    cost_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    sale_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        default=True,
    )

    brand: Mapped["Brand"] = relationship(
        back_populates="products",
    )

    category: Mapped["Category"] = relationship(
        back_populates="products",
    )