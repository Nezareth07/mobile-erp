"""add customer default unique index and manage_default permission

Revision ID: 2498e99f528b
Revises: 8f785625aa88
Create Date: 2026-08-10 23:25:22.664437

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2498e99f528b'
down_revision: Union[str, Sequence[str], None] = '8f785625aa88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Garantiza a nivel de PostgreSQL que como maximo un Customer activo
    # tenga is_default_customer=True. Si la base ya tuviera mas de un
    # default activo, este CREATE UNIQUE INDEX falla de forma visible en
    # vez de aplicarse silenciosamente sobre datos inconsistentes.
    op.create_index(
        'uq_customer_default_active',
        'customer',
        ['is_default_customer'],
        unique=True,
        postgresql_where=sa.text(
            'is_default_customer IS TRUE AND is_active IS TRUE'
        ),
    )

    # Permission de referencia del sistema para el nuevo endpoint
    # PUT /customers/{id}/default. Mismo patron que el seed de permissions
    # en 8f785625aa88_create_auth_tables.py. No se asigna a ningun Role.
    op.execute(
        sa.text(
            "INSERT INTO permission (id, code, description) "
            "VALUES (:id, :code, :description)"
        ).bindparams(
            id=uuid.uuid4(),
            code='customers.manage_default',
            description=(
                'Configure/change the default Customer used by sales '
                'when customer_id is not provided'
            ),
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        sa.text(
            "DELETE FROM permission WHERE code = :code"
        ).bindparams(code='customers.manage_default')
    )

    op.drop_index(
        'uq_customer_default_active',
        table_name='customer',
        postgresql_where=sa.text(
            'is_default_customer IS TRUE AND is_active IS TRUE'
        ),
    )
