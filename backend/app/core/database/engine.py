from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config.settings import settings


engine: AsyncEngine = create_async_engine(
    url=settings.database.url,
    echo=settings.database.echo,
    pool_pre_ping=True,
)