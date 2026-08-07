"""create customer table

Revision ID: bdd4edfd5d36
Revises: 3186956683b6
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bdd4edfd5d36'
down_revision: Union[str, Sequence[str], None] = '3186956683b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'customer',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('document_id', sa.String(length=20), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_default_customer', sa.Boolean(), nullable=False),
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
        sa.PrimaryKeyConstraint('id', name=op.f('pk_customer')),
    )
    op.create_index(
        op.f('ix_customer_name'), 'customer', ['name'], unique=False
    )
    op.create_index(
        'uq_customer_document_id',
        'customer',
        ['document_id'],
        unique=True,
        postgresql_where=sa.text('document_id IS NOT NULL'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'uq_customer_document_id',
        table_name='customer',
        postgresql_where=sa.text('document_id IS NOT NULL'),
    )
    op.drop_index(op.f('ix_customer_name'), table_name='customer')
    op.drop_table('customer')
