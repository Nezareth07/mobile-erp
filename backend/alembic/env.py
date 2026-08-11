from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config.settings import settings
from app.core.database.base import Base

# Importar los modelos para registrarlos en Base.metadata
from app.modules.product.models.brand import Brand  # noqa: F401
from app.modules.product.models.category import Category  # noqa: F401
from app.modules.product.models.product import Product  # noqa: F401
from app.modules.inventory.models.location import Location  # noqa: F401
from app.modules.inventory.models.product_unit import ProductUnit  # noqa: F401
from app.modules.inventory.models.stock_lot import StockLot  # noqa: F401
from app.modules.inventory.models.stock_movement import StockMovement  # noqa: F401
from app.modules.supplier.models.supplier import Supplier  # noqa: F401
from app.modules.purchase.models.purchase import Purchase  # noqa: F401
from app.modules.purchase.models.purchase_line import PurchaseLine  # noqa: F401
from app.modules.customer.models.customer import Customer  # noqa: F401
from app.modules.sale.models.sale import Sale  # noqa: F401
from app.modules.sale.models.sale_line import SaleLine  # noqa: F401
from app.modules.auth.models.user import User  # noqa: F401
from app.modules.auth.models.role import Role  # noqa: F401
from app.modules.auth.models.permission import Permission  # noqa: F401
from app.modules.auth.models.user_role import UserRole  # noqa: F401
from app.modules.auth.models.role_permission import RolePermission  # noqa: F401


config = context.config

# Usar la misma URL que utiliza FastAPI
config.set_main_option("sqlalchemy.url", settings.database.url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Ejecutar migraciones en modo offline."""

    context.configure(
        url=settings.database.url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Ejecutar migraciones usando AsyncEngine."""

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio

    asyncio.run(run_migrations_online())
