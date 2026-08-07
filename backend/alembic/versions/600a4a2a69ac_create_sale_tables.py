"""create sale tables

Revision ID: 600a4a2a69ac
Revises: bdd4edfd5d36
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '600a4a2a69ac'
down_revision: Union[str, Sequence[str], None] = 'bdd4edfd5d36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'sale',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('customer_id', sa.Uuid(), nullable=False),
        sa.Column('location_id', sa.Uuid(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('CONFIRMED', 'CANCELLED', name='salestatus'),
            nullable=False,
        ),
        sa.Column('sale_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'total_amount', sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column(
            'total_cost', sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column(
            'profit', sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column('notes', sa.String(length=500), nullable=True),
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
        sa.CheckConstraint(
            'total_amount >= 0', name=op.f('ck_sale_total_amount_positive')
        ),
        sa.CheckConstraint(
            'total_cost >= 0', name=op.f('ck_sale_total_cost_positive')
        ),
        sa.ForeignKeyConstraint(
            ['customer_id'],
            ['customer.id'],
            name=op.f('fk_sale_customer_id_customer'),
        ),
        sa.ForeignKeyConstraint(
            ['location_id'],
            ['location.id'],
            name=op.f('fk_sale_location_id_location'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sale')),
    )
    op.create_index(
        op.f('ix_sale_customer_id'), 'sale', ['customer_id'], unique=False
    )
    op.create_index(
        op.f('ix_sale_location_id'), 'sale', ['location_id'], unique=False
    )
    op.create_index(
        op.f('ix_sale_sale_date'), 'sale', ['sale_date'], unique=False
    )

    op.create_table(
        'sale_line',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('sale_id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column(
            'unit_price', sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column(
            'unit_cost', sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column(
            'subtotal', sa.Numeric(precision=12, scale=2), nullable=False
        ),
        sa.Column('imei', sa.String(length=15), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'quantity > 0', name=op.f('ck_sale_line_quantity_positive')
        ),
        sa.CheckConstraint(
            'subtotal >= 0', name=op.f('ck_sale_line_subtotal_positive')
        ),
        sa.CheckConstraint(
            'unit_cost >= 0', name=op.f('ck_sale_line_unit_cost_positive')
        ),
        sa.CheckConstraint(
            'unit_price >= 0', name=op.f('ck_sale_line_unit_price_positive')
        ),
        sa.ForeignKeyConstraint(
            ['product_id'],
            ['product.id'],
            name=op.f('fk_sale_line_product_id_product'),
        ),
        sa.ForeignKeyConstraint(
            ['sale_id'],
            ['sale.id'],
            name=op.f('fk_sale_line_sale_id_sale'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sale_line')),
    )
    op.create_index(
        op.f('ix_sale_line_product_id'),
        'sale_line',
        ['product_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_sale_line_sale_id'), 'sale_line', ['sale_id'], unique=False
    )

    op.add_column(
        'product_unit', sa.Column('sale_line_id', sa.Uuid(), nullable=True)
    )
    op.create_index(
        op.f('ix_product_unit_sale_line_id'),
        'product_unit',
        ['sale_line_id'],
        unique=False,
    )
    op.create_foreign_key(
        op.f('fk_product_unit_sale_line_id_sale_line'),
        'product_unit',
        'sale_line',
        ['sale_line_id'],
        ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f('fk_product_unit_sale_line_id_sale_line'),
        'product_unit',
        type_='foreignkey',
    )
    op.drop_index(
        op.f('ix_product_unit_sale_line_id'), table_name='product_unit'
    )
    op.drop_column('product_unit', 'sale_line_id')

    op.drop_index(op.f('ix_sale_line_sale_id'), table_name='sale_line')
    op.drop_index(op.f('ix_sale_line_product_id'), table_name='sale_line')
    op.drop_table('sale_line')

    op.drop_index(op.f('ix_sale_sale_date'), table_name='sale')
    op.drop_index(op.f('ix_sale_location_id'), table_name='sale')
    op.drop_index(op.f('ix_sale_customer_id'), table_name='sale')
    op.drop_table('sale')
