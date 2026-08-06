from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.purchase.models.purchase_line import PurchaseLine


class PurchaseLineRepository(BaseRepository[PurchaseLine]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, PurchaseLine)
