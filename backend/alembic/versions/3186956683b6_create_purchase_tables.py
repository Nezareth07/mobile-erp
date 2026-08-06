"""create purchase tables

Revision ID: 3186956683b6
Revises: 8ceee1843af6
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3186956683b6'
down_revision: Union[str, Sequence[str], None] = '8ceee1843af6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'purchase',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('supplier_id', sa.Uuid(), nullable=False),
        sa.Column('location_id', sa.Uuid(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('CONFIRMED', 'CANCELLED', name='purchasestatus'),
            nullable=False,
        ),
        sa.Column('invoice_number', sa.String(length=50), nullable=True),
        sa.Column(
            'purchase_date', sa.DateTime(timezone=True), nullable=False
        ),
        sa.Column('total_cost', sa.Numeric(precision=12, scale=2), nullable=False),
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
            'total_cost >= 0', name=op.f('ck_purchase_total_cost_positive')
        ),
        sa.ForeignKeyConstraint(
            ['location_id'],
            ['location.id'],
            name=op.f('fk_purchase_location_id_location'),
        ),
        sa.ForeignKeyConstraint(
            ['supplier_id'],
            ['supplier.id'],
            name=op.f('fk_purchase_supplier_id_supplier'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_purchase')),
    )
    op.create_index(
        op.f('ix_purchase_location_id'), 'purchase', ['location_id'], unique=False
    )
    op.create_index(
        op.f('ix_purchase_purchase_date'),
        'purchase',
        ['purchase_date'],
        unique=False,
    )
    op.create_index(
        op.f('ix_purchase_supplier_id'), 'purchase', ['supplier_id'], unique=False
    )

    op.create_table(
        'purchase_line',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('purchase_id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('subtotal', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('imei', sa.String(length=15), nullable=True),
        sa.Column('imei2', sa.String(length=15), nullable=True),
        sa.Column('lot_code', sa.String(length=50), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'quantity > 0', name=op.f('ck_purchase_line_quantity_positive')
        ),
        sa.CheckConstraint(
            'unit_cost >= 0', name=op.f('ck_purchase_line_unit_cost_positive')
        ),
        sa.CheckConstraint(
            'subtotal >= 0', name=op.f('ck_purchase_line_subtotal_positive')
        ),
        sa.ForeignKeyConstraint(
            ['product_id'],
            ['product.id'],
            name=op.f('fk_purchase_line_product_id_product'),
        ),
        sa.ForeignKeyConstraint(
            ['purchase_id'],
            ['purchase.id'],
            name=op.f('fk_purchase_line_purchase_id_purchase'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_purchase_line')),
    )
    op.create_index(
        op.f('ix_purchase_line_product_id'),
        'purchase_line',
        ['product_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_purchase_line_purchase_id'),
        'purchase_line',
        ['purchase_id'],
        unique=False,
    )

    op.add_column(
        'product_unit',
        sa.Column('purchase_line_id', sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f('ix_product_unit_purchase_line_id'),
        'product_unit',
        ['purchase_line_id'],
        unique=False,
    )
    op.create_foreign_key(
        op.f('fk_product_unit_purchase_line_id_purchase_line'),
        'product_unit',
        'purchase_line',
        ['purchase_line_id'],
        ['id'],
    )

    op.add_column(
        'stock_lot',
        sa.Column('purchase_line_id', sa.Uuid(), nullable=True),
    )
    op.create_index(
        op.f('ix_stock_lot_purchase_line_id'),
        'stock_lot',
        ['purchase_line_id'],
        unique=False,
    )
    op.create_foreign_key(
        op.f('fk_stock_lot_purchase_line_id_purchase_line'),
        'stock_lot',
        'purchase_line',
        ['purchase_line_id'],
        ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f('fk_stock_lot_purchase_line_id_purchase_line'),
        'stock_lot',
        type_='foreignkey',
    )
    op.drop_index(
        op.f('ix_stock_lot_purchase_line_id'), table_name='stock_lot'
    )
    op.drop_column('stock_lot', 'purchase_line_id')

    op.drop_constraint(
        op.f('fk_product_unit_purchase_line_id_purchase_line'),
        'product_unit',
        type_='foreignkey',
    )
    op.drop_index(
        op.f('ix_product_unit_purchase_line_id'), table_name='product_unit'
    )
    op.drop_column('product_unit', 'purchase_line_id')

    op.drop_index(
        op.f('ix_purchase_line_purchase_id'), table_name='purchase_line'
    )
    op.drop_index(
        op.f('ix_purchase_line_product_id'), table_name='purchase_line'
    )
    op.drop_table('purchase_line')

    op.drop_index(op.f('ix_purchase_supplier_id'), table_name='purchase')
    op.drop_index(op.f('ix_purchase_purchase_date'), table_name='purchase')
    op.drop_index(op.f('ix_purchase_location_id'), table_name='purchase')
    op.drop_table('purchase')

    sa.Enum(name='purchasestatus').drop(op.get_bind(), checkfirst=True)
