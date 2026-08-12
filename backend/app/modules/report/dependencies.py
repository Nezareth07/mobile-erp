from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.modules.report.services.report_service import ReportService


def get_report_service(
    session: AsyncSession = Depends(get_session),
) -> ReportService:
    return ReportService(session)
