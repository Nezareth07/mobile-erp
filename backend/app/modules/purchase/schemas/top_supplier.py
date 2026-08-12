from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.supplier.schemas.supplier_summary import SupplierSummary


class TopSupplier(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier: SupplierSummary
    purchases_count: int
    total_cost: Decimal
