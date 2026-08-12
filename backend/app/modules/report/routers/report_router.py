from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.modules.auth.dependencies import require_permission
from app.modules.inventory.enums.movement_type import MovementType
from app.modules.inventory.schemas.recent_activity_item import (
    RecentActivityItem,
)
from app.modules.inventory.schemas.stock_valuation_line import (
    StockValuationLine,
)
from app.modules.purchase.schemas.daily_purchases_point import (
    DailyPurchasesPoint,
)
from app.modules.purchase.schemas.purchases_summary import PurchasesSummary
from app.modules.purchase.schemas.top_purchased_product import (
    TopPurchasedProduct,
)
from app.modules.purchase.schemas.top_supplier import TopSupplier
from app.modules.report.dependencies import get_report_service
from app.modules.report.schemas.sales_summary_report import (
    SalesSummaryReport,
)
from app.modules.report.services.report_service import ReportService
from app.modules.sale.schemas.daily_sales_point import DailySalesPoint
from app.modules.sale.schemas.top_customer import TopCustomer
from app.modules.sale.schemas.top_selling_product import TopSellingProduct

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)

_DATE_FROM_DESCRIPTION = (
    "Start of the range (inclusive, UTC). Defaults to date_to if given, "
    "otherwise today."
)
_DATE_TO_DESCRIPTION = (
    "End of the range (exclusive, UTC) -- the range covered is "
    "[date_from, date_to). Defaults to the day after date_from if given, "
    "otherwise tomorrow."
)


# --- sales --------------------------------------------------------------


@router.get(
    "/sales/summary",
    response_model=SalesSummaryReport,
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_sales_summary(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.get_sales_summary(date_from, date_to, location_id)


@router.get(
    "/sales/timeseries",
    response_model=list[DailySalesPoint],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_sales_timeseries(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.get_sales_timeseries(date_from, date_to, location_id)


@router.get(
    "/sales/top-products",
    response_model=list[TopSellingProduct],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_sales_top_products(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    limit: int = Query(default=10, gt=0, le=100),
    order_by: str = Query(default="revenue", pattern="^(revenue|quantity)$"),
    service: ReportService = Depends(get_report_service),
):
    return await service.get_sales_top_products(
        date_from, date_to, location_id, limit, order_by
    )


@router.get(
    "/sales/top-customers",
    response_model=list[TopCustomer],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_sales_top_customers(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    limit: int = Query(default=10, gt=0, le=100),
    service: ReportService = Depends(get_report_service),
):
    return await service.get_sales_top_customers(
        date_from, date_to, location_id, limit
    )


# --- purchases ------------------------------------------------------------


@router.get(
    "/purchases/summary",
    response_model=PurchasesSummary,
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_purchases_summary(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.get_purchases_summary(
        date_from, date_to, location_id
    )


@router.get(
    "/purchases/timeseries",
    response_model=list[DailyPurchasesPoint],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_purchases_timeseries(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.get_purchases_timeseries(
        date_from, date_to, location_id
    )


@router.get(
    "/purchases/top-suppliers",
    response_model=list[TopSupplier],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_purchases_top_suppliers(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    limit: int = Query(default=10, gt=0, le=100),
    service: ReportService = Depends(get_report_service),
):
    return await service.get_purchases_top_suppliers(
        date_from, date_to, location_id, limit
    )


@router.get(
    "/purchases/top-products",
    response_model=list[TopPurchasedProduct],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_purchases_top_products(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    limit: int = Query(default=10, gt=0, le=100),
    order_by: str = Query(default="cost", pattern="^(cost|quantity)$"),
    service: ReportService = Depends(get_report_service),
):
    return await service.get_purchases_top_products(
        date_from, date_to, location_id, limit, order_by
    )


# --- inventory --------------------------------------------------------


@router.get(
    "/inventory/valuation",
    response_model=list[StockValuationLine],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_inventory_valuation(
    location_id: UUID | None = None,
    service: ReportService = Depends(get_report_service),
):
    return await service.get_inventory_valuation(location_id)


@router.get(
    "/inventory/movements",
    response_model=list[RecentActivityItem],
    dependencies=[Depends(require_permission("reports.read"))],
)
async def get_inventory_movements(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    product_id: UUID | None = None,
    location_id: UUID | None = None,
    movement_type: MovementType | None = None,
    limit: int = Query(default=50, gt=0, le=100),
    offset: int = Query(default=0, ge=0),
    service: ReportService = Depends(get_report_service),
):
    return await service.get_inventory_movements(
        date_from,
        date_to,
        product_id,
        location_id,
        movement_type,
        limit,
        offset,
    )
