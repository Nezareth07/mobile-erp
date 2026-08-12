from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.modules.inventory.enums.movement_type import MovementType
from app.modules.inventory.models.stock_movement import StockMovement
from app.modules.inventory.schemas.stock_valuation_line import (
    StockValuationLine,
)
from app.modules.inventory.services.inventory_service import InventoryService
from app.modules.purchase.schemas.daily_purchases_point import (
    DailyPurchasesPoint,
)
from app.modules.purchase.schemas.purchases_summary import PurchasesSummary
from app.modules.purchase.schemas.top_purchased_product import (
    TopPurchasedProduct,
)
from app.modules.purchase.schemas.top_supplier import TopSupplier
from app.modules.purchase.services.purchase_service import PurchaseService
from app.modules.report.schemas.sales_summary_report import (
    SalesSummaryReport,
)
from app.modules.sale.schemas.daily_sales_point import DailySalesPoint
from app.modules.sale.schemas.top_customer import TopCustomer
from app.modules.sale.schemas.top_selling_product import TopSellingProduct
from app.modules.sale.services.sale_service import SaleService


class ReportService:
    """Orquestador de solo lectura: mismo patron que DashboardService
    (Fase 7) -- nunca instancia ni consulta repositorios de otros modulos
    directamente, solo llama a metodos publicos de
    SaleService/PurchaseService/InventoryService. Ninguna query de este
    Service duplica una ya existente en esos tres; donde Reports necesita
    algo que Dashboard no necesitaba (lado compra, valuacion, ledger
    filtrado), el metodo nuevo vive en el Service dueno de esos datos, no
    aqui."""

    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session

        self.sale_service = SaleService(session)
        self.purchase_service = PurchaseService(session)
        self.inventory_service = InventoryService(session)

    async def get_sales_summary(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
    ) -> SalesSummaryReport:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        summary = await self.sale_service.get_sales_summary(
            resolved_from, resolved_to, location_id
        )

        return SalesSummaryReport(
            sales_count=summary.sales_count,
            total_amount=summary.total_amount,
            total_cost=summary.total_cost,
            total_profit=summary.total_profit,
            profit_margin=_profit_margin(
                summary.total_profit, summary.total_amount
            ),
        )

    async def get_sales_timeseries(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
    ) -> list[DailySalesPoint]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.sale_service.get_daily_sales_overview(
            resolved_from, resolved_to, location_id
        )

    async def get_sales_top_products(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
        limit: int,
        order_by: str,
    ) -> list[TopSellingProduct]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.sale_service.get_top_products(
            resolved_from, resolved_to, location_id, limit, order_by
        )

    async def get_sales_top_customers(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
        limit: int,
    ) -> list[TopCustomer]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.sale_service.get_top_customers(
            resolved_from, resolved_to, location_id, limit
        )

    async def get_purchases_summary(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
    ) -> PurchasesSummary:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.purchase_service.get_purchases_summary(
            resolved_from, resolved_to, location_id
        )

    async def get_purchases_timeseries(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
    ) -> list[DailyPurchasesPoint]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.purchase_service.get_daily_purchases_overview(
            resolved_from, resolved_to, location_id
        )

    async def get_purchases_top_suppliers(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
        limit: int,
    ) -> list[TopSupplier]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.purchase_service.get_top_suppliers(
            resolved_from, resolved_to, location_id, limit
        )

    async def get_purchases_top_products(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
        limit: int,
        order_by: str,
    ) -> list[TopPurchasedProduct]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.purchase_service.get_top_purchased_products(
            resolved_from, resolved_to, location_id, limit, order_by
        )

    async def get_inventory_valuation(
        self,
        location_id: UUID | None,
    ) -> list[StockValuationLine]:
        return await self.inventory_service.get_stock_valuation(location_id)

    async def get_inventory_movements(
        self,
        date_from: date | None,
        date_to: date | None,
        product_id: UUID | None,
        location_id: UUID | None,
        movement_type: MovementType | None,
        limit: int,
        offset: int,
    ) -> list[StockMovement]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.inventory_service.get_movements_report(
            resolved_from,
            resolved_to,
            product_id,
            location_id,
            movement_type,
            limit,
            offset,
        )


def _resolve_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[datetime, datetime]:
    """Duplicado deliberado de DashboardService._resolve_date_range
    (app/modules/dashboard/services/dashboard_service.py) -- mismo rango
    [date_from, date_to) exclusivo, UTC, default a "hoy" si se omiten
    ambos. No se extrajo a un modulo compartido: se sigue el mismo criterio
    ya aprobado para los metodos nuevos de Purchase (replicar el patron
    existente en vez de introducir una abstraccion nueva no contemplada en
    el diseño aprobado de Fase 8)."""
    today = datetime.now(timezone.utc).date()

    resolved_from = date_from or date_to or today
    resolved_to = date_to or (
        (date_from + timedelta(days=1))
        if date_from is not None
        else today + timedelta(days=1)
    )

    if resolved_from >= resolved_to:
        raise BadRequestException(
            "date_from must be strictly before date_to."
        )

    start = datetime.combine(resolved_from, time.min, tzinfo=timezone.utc)
    end = datetime.combine(resolved_to, time.min, tzinfo=timezone.utc)

    return start, end


def _profit_margin(
    total_profit: Decimal,
    total_amount: Decimal,
) -> Decimal | None:
    if total_amount == 0:
        return None

    return (total_profit / total_amount) * 100
