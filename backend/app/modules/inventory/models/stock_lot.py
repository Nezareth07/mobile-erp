from datetime import datetime
from decimal import Decimal
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.uuid import UUIDMixin


class StockLot(
    UUIDMixin,
    Base,
):
    __tablename__ = "stock_lot"

    __table_args__ = (
        CheckConstraint(
            "unit_cost >= 0",
            name="unit_cost_positive",
        ),
        CheckConstraint(
            "quantity_available >= 0 AND quantity_available <= quantity_received",
            name="quantity_available_within_range",
        ),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product.id"),
        nullable=False,
        index=True,
    )

    lot_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    quantity_received: Mapped[int] = mapped_column(
        nullable=False,
    )

    quantity_available: Mapped[int] = mapped_column(
        nullable=False,
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

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
