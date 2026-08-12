from datetime import date

from pydantic import BaseModel, ConfigDict

from app.modules.purchase.schemas.purchases_summary import PurchasesSummary
from app.modules.sale.schemas.sales_summary import SalesSummary


class DashboardSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sales_today: SalesSummary
    sales_period: SalesSummary
    purchases_period: PurchasesSummary
    period_date_from: date
    period_date_to: date
    active_customers_count: int
    active_products_count: int
    active_suppliers_count: int
