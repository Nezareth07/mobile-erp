from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.purchase.services.purchase_service import PurchaseService


def get_purchase_service(
    session: AsyncSession = Depends(get_session),
) -> PurchaseService:
    return PurchaseService(session)
