from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.inventory.services.inventory_service import InventoryService


def get_inventory_service(
    session: AsyncSession = Depends(get_session),
) -> InventoryService:
    return InventoryService(session)
