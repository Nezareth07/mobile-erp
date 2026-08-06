"""create supplier table

Revision ID: 8ceee1843af6
Revises: 879831f26f89
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8ceee1843af6'
down_revision: Union[str, Sequence[str], None] = '879831f26f89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'supplier',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('tax_id', sa.String(length=20), nullable=True),
        sa.Column('contact_name', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_supplier')),
    )
    op.create_index(
        op.f('ix_supplier_name'), 'supplier', ['name'], unique=True
    )
    op.create_index(
        op.f('ix_supplier_tax_id'), 'supplier', ['tax_id'], unique=True
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_supplier_tax_id'), table_name='supplier')
    op.drop_index(op.f('ix_supplier_name'), table_name='supplier')
    op.drop_table('supplier')
