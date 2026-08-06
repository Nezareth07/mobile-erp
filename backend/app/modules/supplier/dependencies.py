from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.supplier.services.supplier_service import SupplierService


def get_supplier_service(
    session: AsyncSession = Depends(get_session),
) -> SupplierService:
    return SupplierService(session)
