"""add stock movement created at index

Revision ID: 0d58091f77c3
Revises: ed6e9ff18e8d
Create Date: 2026-08-12 15:55:13.832078

Justificacion (Fase 7 - Dashboard, GET /dashboard/recent-activity):
`stock_movement` es un ledger append-only que crece con cada linea de
compra, venta y ajuste (ver InventoryService) -- hoy solo tiene indices en
location_id/product_id/product_unit_id/stock_lot_id (879831f26f89), pero
ninguno en created_at. El nuevo endpoint hace
`ORDER BY created_at DESC LIMIT :limit` sin ningun WHERE que reduzca antes
las filas candidatas (location_id es el unico filtro opcional), por lo que
sin este indice Postgres tendria que hacer sort completo de la tabla en
cada llamada, empeorando con el tiempo a medida que el ledger crece. Se
verificaron los indices existentes antes de agregar este.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0d58091f77c3'
down_revision: Union[str, Sequence[str], None] = 'ed6e9ff18e8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        op.f('ix_stock_movement_created_at'),
        'stock_movement',
        ['created_at'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f('ix_stock_movement_created_at'), table_name='stock_movement'
    )
