from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.modules.customer.services.customer_service import CustomerService
from app.modules.inventory.models.stock_movement import StockMovement
from app.modules.inventory.services.inventory_service import InventoryService
from app.modules.product.services.product_service import ProductService
from app.modules.purchase.services.purchase_service import PurchaseService
from app.modules.sale.schemas.daily_sales_point import DailySalesPoint
from app.modules.sale.schemas.top_customer import TopCustomer
from app.modules.sale.schemas.top_selling_product import TopSellingProduct
from app.modules.sale.services.sale_service import SaleService
from app.modules.supplier.services.supplier_service import SupplierService

from app.modules.dashboard.schemas.dashboard_summary_response import (
    DashboardSummaryResponse,
)


class DashboardService:
    """Orquestador de solo lectura: nunca instancia ni consulta repositorios
    de otros modulos directamente (regla explicita de Fase 7). Cada
    agregacion vive en el Service dueno de esos datos (Sale, Purchase,
    Inventory) para que Reports (Fase 8) pueda reutilizar exactamente los
    mismos metodos con sus propios rangos, sin duplicar queries."""

    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session

        self.sale_service = SaleService(session)
        self.purchase_service = PurchaseService(session)
        self.inventory_service = InventoryService(session)
        self.customer_service = CustomerService(session)
        self.product_service = ProductService(session)
        self.supplier_service = SupplierService(session)

    async def get_summary(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
    ) -> DashboardSummaryResponse:
        today_from, today_to = _utc_today_bounds()
        period_from, period_to = _resolve_date_range(date_from, date_to)

        sales_today = await self.sale_service.get_sales_summary(
            today_from, today_to, location_id
        )
        sales_period = await self.sale_service.get_sales_summary(
            period_from, period_to, location_id
        )
        purchases_period = await self.purchase_service.get_purchases_summary(
            period_from, period_to, location_id
        )
        active_customers_count = (
            await self.customer_service.count_active_customers()
        )
        active_products_count = (
            await self.product_service.count_active_products()
        )
        active_suppliers_count = (
            await self.supplier_service.count_active_suppliers()
        )

        return DashboardSummaryResponse(
            sales_today=sales_today,
            sales_period=sales_period,
            purchases_period=purchases_period,
            period_date_from=period_from.date(),
            period_date_to=period_to.date(),
            active_customers_count=active_customers_count,
            active_products_count=active_products_count,
            active_suppliers_count=active_suppliers_count,
        )

    async def get_sales_overview(
        self,
        date_from: date | None,
        date_to: date | None,
        location_id: UUID | None,
    ) -> list[DailySalesPoint]:
        resolved_from, resolved_to = _resolve_date_range(date_from, date_to)

        return await self.sale_service.get_daily_sales_overview(
            resolved_from, resolved_to, location_id
        )

    async def get_top_products(
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

    async def get_top_customers(
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

    async def get_recent_activity(
        self,
        limit: int,
        location_id: UUID | None,
    ) -> list[StockMovement]:
        return await self.inventory_service.get_recent_movements(
            limit, location_id
        )


def _utc_today_bounds() -> tuple[datetime, datetime]:
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(today, time.min, tzinfo=timezone.utc)

    return start, start + timedelta(days=1)


def _resolve_date_range(
    date_from: date | None,
    date_to: date | None,
) -> tuple[datetime, datetime]:
    """Resuelve el rango [date_from, date_to) de los endpoints de
    Dashboard -- date_to es exclusivo. Si se omiten ambos, se usa el dia
    de hoy en UTC (unica zona horaria que usa la app: todo timestamp se
    escribe con `datetime.now(timezone.utc)`, ver Sale/PurchaseService).
    Si se pasa solo uno de los dos, se completa el otro para formar una
    ventana de un solo dia alrededor del valor dado."""
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
