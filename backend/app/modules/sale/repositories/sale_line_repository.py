from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repositories.base_repository import BaseRepository
from app.modules.sale.models.sale_line import SaleLine


class SaleLineRepository(BaseRepository[SaleLine]):
    def __init__(
        self,
        session: AsyncSession,
    ):
        super().__init__(session, SaleLine)
