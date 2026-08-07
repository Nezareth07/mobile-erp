from datetime import datetime
from decimal import Decimal
import uuid

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database.base import Base
from app.core.database.mixins.timestamp import TimestampMixin
from app.core.database.mixins.uuid import UUIDMixin
from app.modules.sale.enums.sale_status import SaleStatus


class Sale(
    UUIDMixin,
    TimestampMixin,
    Base,
):
    __tablename__ = "sale"

    __table_args__ = (
        CheckConstraint(
            "total_amount >= 0",
            name="total_amount_positive",
        ),
        CheckConstraint(
            "total_cost >= 0",
            name="total_cost_positive",
        ),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customer.id"),
        nullable=False,
        index=True,
    )

    location_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("location.id"),
        nullable=False,
        index=True,
    )

    status: Mapped[SaleStatus] = mapped_column(
        Enum(SaleStatus),
        nullable=False,
        default=SaleStatus.CONFIRMED,
    )

    sale_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    profit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    customer: Mapped["Customer"] = relationship()

    location: Mapped["Location"] = relationship()

    lines: Mapped[list["SaleLine"]] = relationship(
        back_populates="sale",
        order_by="SaleLine.created_at",
    )
