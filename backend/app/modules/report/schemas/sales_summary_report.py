from decimal import Decimal

from app.modules.sale.schemas.sales_summary import SalesSummary


class SalesSummaryReport(SalesSummary):
    profit_margin: Decimal | None
