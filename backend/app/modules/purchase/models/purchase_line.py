from datetime import datetime
from decimal import Decimal
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.uuid import UUIDMixin


class PurchaseLine(
    UUIDMixin,
    Base,
):
    __tablename__ = "purchase_line"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="quantity_positive",
        ),
        CheckConstraint(
            "unit_cost >= 0",
            name="unit_cost_positive",
        ),
        CheckConstraint(
            "subtotal >= 0",
            name="subtotal_positive",
        ),
    )

    purchase_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("purchase.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product.id"),
        nullable=False,
        index=True,
    )

    quantity: Mapped[int] = mapped_column(
        nullable=False,
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    imei: Mapped[str | None] = mapped_column(
        String(15),
        nullable=True,
    )

    imei2: Mapped[str | None] = mapped_column(
        String(15),
        nullable=True,
    )

    lot_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    purchase: Mapped["Purchase"] = relationship(
        back_populates="lines",
    )

    product: Mapped["Product"] = relationship()
