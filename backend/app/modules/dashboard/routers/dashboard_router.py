from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.modules.auth.dependencies import require_permission
from app.modules.dashboard.dependencies import get_dashboard_service
from app.modules.dashboard.schemas.dashboard_summary_response import (
    DashboardSummaryResponse,
)
from app.modules.dashboard.schemas.recent_activity_item import (
    RecentActivityItem,
)
from app.modules.dashboard.services.dashboard_service import DashboardService
from app.modules.sale.schemas.daily_sales_point import DailySalesPoint
from app.modules.sale.schemas.top_customer import TopCustomer
from app.modules.sale.schemas.top_selling_product import TopSellingProduct

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
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


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    dependencies=[Depends(require_permission("dashboard.read"))],
)
async def get_summary(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_summary(date_from, date_to, location_id)


@router.get(
    "/sales-overview",
    response_model=list[DailySalesPoint],
    dependencies=[Depends(require_permission("dashboard.read"))],
)
async def get_sales_overview(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_sales_overview(date_from, date_to, location_id)


@router.get(
    "/top-products",
    response_model=list[TopSellingProduct],
    dependencies=[Depends(require_permission("dashboard.read"))],
)
async def get_top_products(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    limit: int = Query(default=5, gt=0, le=50),
    order_by: str = Query(default="revenue", pattern="^(revenue|quantity)$"),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_top_products(
        date_from, date_to, location_id, limit, order_by
    )


@router.get(
    "/top-customers",
    response_model=list[TopCustomer],
    dependencies=[Depends(require_permission("dashboard.read"))],
)
async def get_top_customers(
    date_from: date | None = Query(
        default=None, description=_DATE_FROM_DESCRIPTION
    ),
    date_to: date | None = Query(
        default=None, description=_DATE_TO_DESCRIPTION
    ),
    location_id: UUID | None = None,
    limit: int = Query(default=5, gt=0, le=50),
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_top_customers(
        date_from, date_to, location_id, limit
    )


@router.get(
    "/recent-activity",
    response_model=list[RecentActivityItem],
    dependencies=[Depends(require_permission("dashboard.read"))],
)
async def get_recent_activity(
    limit: int = Query(default=20, gt=0, le=100),
    location_id: UUID | None = None,
    service: DashboardService = Depends(get_dashboard_service),
):
    return await service.get_recent_activity(limit, location_id)
