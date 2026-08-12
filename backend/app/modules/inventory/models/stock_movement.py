from datetime import datetime
from decimal import Decimal
import uuid

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.uuid import UUIDMixin
from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.enums.movement_type import MovementType


class StockMovement(
    UUIDMixin,
    Base,
):
    __tablename__ = "stock_movement"

    __table_args__ = (
        CheckConstraint(
            "unit_cost >= 0",
            name="unit_cost_positive",
        ),
        CheckConstraint(
            "(product_unit_id IS NOT NULL AND stock_lot_id IS NULL) "
            "OR (product_unit_id IS NULL AND stock_lot_id IS NOT NULL)",
            name="exactly_one_stock_reference",
        ),
    )

    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product.id"),
        nullable=False,
        index=True,
    )

    movement_type: Mapped[MovementType] = mapped_column(
        Enum(MovementType),
        nullable=False,
    )

    product_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("product_unit.id"),
        nullable=True,
        index=True,
    )

    stock_lot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stock_lot.id"),
        nullable=True,
        index=True,
    )

    quantity: Mapped[int | None] = mapped_column(
        nullable=True,
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

    source_type: Mapped[MovementSourceType] = mapped_column(
        Enum(MovementSourceType),
        nullable=False,
    )

    source_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    product: Mapped["Product"] = relationship()

    location: Mapped["Location"] = relationship()
