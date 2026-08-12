from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.dashboard.services.dashboard_service import DashboardService


def get_dashboard_service(
    session: AsyncSession = Depends(get_session),
) -> DashboardService:
    return DashboardService(session)
