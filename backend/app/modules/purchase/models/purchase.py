from datetime import datetime
from decimal import Decimal
import uuid

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin
from app.modules.purchase.enums.purchase_status import PurchaseStatus


class Purchase(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "purchase"

    __table_args__ = (
        CheckConstraint(
            "total_cost >= 0",
            name="total_cost_positive",
        ),
    )

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("supplier.id"),
        nullable=False,
        index=True,
    )

    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("location.id"),
        nullable=False,
        index=True,
    )

    status: Mapped[PurchaseStatus] = mapped_column(
        Enum(PurchaseStatus),
        nullable=False,
        default=PurchaseStatus.CONFIRMED,
    )

    invoice_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    supplier: Mapped["Supplier"] = relationship()

    location: Mapped["Location"] = relationship()

    lines: Mapped[list["PurchaseLine"]] = relationship(
        back_populates="purchase",
        order_by="PurchaseLine.created_at",
    )
