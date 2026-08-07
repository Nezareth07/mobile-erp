from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.sale.services.sale_service import SaleService


def get_sale_service(
    session: AsyncSession = Depends(get_session),
) -> SaleService:
    return SaleService(session)
