"""create inventory tables

Revision ID: 879831f26f89
Revises: 0ccfb4f7eb63
Create Date: 2026-08-06 00:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '879831f26f89'
down_revision: Union[str, Sequence[str], None] = '0ccfb4f7eb63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'location',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column(
            'type',
            sa.Enum('STORE', 'WAREHOUSE', 'ONLINE', name='locationtype'),
            nullable=False,
        ),
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
        sa.PrimaryKeyConstraint('id', name=op.f('pk_location')),
    )
    op.create_index(
        op.f('ix_location_name'), 'location', ['name'], unique=True
    )

    op.create_table(
        'product_unit',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column('imei', sa.String(length=15), nullable=False),
        sa.Column('imei2', sa.String(length=15), nullable=True),
        sa.Column(
            'status',
            sa.Enum(
                'IN_STOCK',
                'RESERVED',
                'SOLD',
                'IN_WARRANTY',
                'DEFECTIVE',
                'RETURNED_TO_SUPPLIER',
                name='productunitstatus',
            ),
            nullable=False,
        ),
        sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('location_id', sa.Uuid(), nullable=False),
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
            'unit_cost >= 0', name=op.f('ck_product_unit_unit_cost_positive')
        ),
        sa.ForeignKeyConstraint(
            ['location_id'],
            ['location.id'],
            name=op.f('fk_product_unit_location_id_location'),
        ),
        sa.ForeignKeyConstraint(
            ['product_id'],
            ['product.id'],
            name=op.f('fk_product_unit_product_id_product'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_product_unit')),
    )
    op.create_index(
        op.f('ix_product_unit_imei'), 'product_unit', ['imei'], unique=True
    )
    op.create_index(
        op.f('ix_product_unit_imei2'), 'product_unit', ['imei2'], unique=True
    )
    op.create_index(
        op.f('ix_product_unit_location_id'),
        'product_unit',
        ['location_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_product_unit_product_id'),
        'product_unit',
        ['product_id'],
        unique=False,
    )

    op.create_table(
        'stock_lot',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column('lot_code', sa.String(length=50), nullable=True),
        sa.Column('quantity_received', sa.Integer(), nullable=False),
        sa.Column('quantity_available', sa.Integer(), nullable=False),
        sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('location_id', sa.Uuid(), nullable=False),
        sa.Column(
            'received_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'unit_cost >= 0', name=op.f('ck_stock_lot_unit_cost_positive')
        ),
        sa.CheckConstraint(
            'quantity_available >= 0 AND quantity_available <= quantity_received',
            name=op.f('ck_stock_lot_quantity_available_within_range'),
        ),
        sa.ForeignKeyConstraint(
            ['location_id'],
            ['location.id'],
            name=op.f('fk_stock_lot_location_id_location'),
        ),
        sa.ForeignKeyConstraint(
            ['product_id'],
            ['product.id'],
            name=op.f('fk_stock_lot_product_id_product'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_stock_lot')),
    )
    op.create_index(
        op.f('ix_stock_lot_location_id'),
        'stock_lot',
        ['location_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_stock_lot_product_id'), 'stock_lot', ['product_id'], unique=False
    )

    op.create_table(
        'stock_movement',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('product_id', sa.Uuid(), nullable=False),
        sa.Column(
            'movement_type',
            sa.Enum(
                'PURCHASE_IN',
                'SALE_OUT',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
                'RETURN_IN',
                'RETURN_OUT',
                'WARRANTY_OUT',
                'WARRANTY_IN',
                'TRANSFER_IN',
                'TRANSFER_OUT',
                name='movementtype',
            ),
            nullable=False,
        ),
        sa.Column('product_unit_id', sa.Uuid(), nullable=True),
        sa.Column('stock_lot_id', sa.Uuid(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('location_id', sa.Uuid(), nullable=False),
        sa.Column(
            'source_type',
            sa.Enum(
                'MANUAL', 'PURCHASE', 'SALE', 'WARRANTY', 'TRANSFER',
                name='movementsourcetype',
            ),
            nullable=False,
        ),
        sa.Column('source_reference', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint(
            'unit_cost >= 0', name=op.f('ck_stock_movement_unit_cost_positive')
        ),
        sa.CheckConstraint(
            '(product_unit_id IS NOT NULL AND stock_lot_id IS NULL) '
            'OR (product_unit_id IS NULL AND stock_lot_id IS NOT NULL)',
            name=op.f('ck_stock_movement_exactly_one_stock_reference'),
        ),
        sa.ForeignKeyConstraint(
            ['location_id'],
            ['location.id'],
            name=op.f('fk_stock_movement_location_id_location'),
        ),
        sa.ForeignKeyConstraint(
            ['product_id'],
            ['product.id'],
            name=op.f('fk_stock_movement_product_id_product'),
        ),
        sa.ForeignKeyConstraint(
            ['product_unit_id'],
            ['product_unit.id'],
            name=op.f('fk_stock_movement_product_unit_id_product_unit'),
        ),
        sa.ForeignKeyConstraint(
            ['stock_lot_id'],
            ['stock_lot.id'],
            name=op.f('fk_stock_movement_stock_lot_id_stock_lot'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_stock_movement')),
    )
    op.create_index(
        op.f('ix_stock_movement_location_id'),
        'stock_movement',
        ['location_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_stock_movement_product_id'),
        'stock_movement',
        ['product_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_stock_movement_product_unit_id'),
        'stock_movement',
        ['product_unit_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_stock_movement_stock_lot_id'),
        'stock_movement',
        ['stock_lot_id'],
        unique=False,
    )

    op.execute(
        sa.text(
            "INSERT INTO location (id, name, type, is_active) "
            "VALUES (:id, :name, CAST(:type AS locationtype), :is_active)"
        ).bindparams(
            id=uuid.uuid4(),
            name='Tienda Principal',
            type='STORE',
            is_active=True,
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f('ix_stock_movement_stock_lot_id'), table_name='stock_movement'
    )
    op.drop_index(
        op.f('ix_stock_movement_product_unit_id'), table_name='stock_movement'
    )
    op.drop_index(
        op.f('ix_stock_movement_product_id'), table_name='stock_movement'
    )
    op.drop_index(
        op.f('ix_stock_movement_location_id'), table_name='stock_movement'
    )
    op.drop_table('stock_movement')

    op.drop_index(op.f('ix_stock_lot_product_id'), table_name='stock_lot')
    op.drop_index(op.f('ix_stock_lot_location_id'), table_name='stock_lot')
    op.drop_table('stock_lot')

    op.drop_index(op.f('ix_product_unit_product_id'), table_name='product_unit')
    op.drop_index(op.f('ix_product_unit_location_id'), table_name='product_unit')
    op.drop_index(op.f('ix_product_unit_imei2'), table_name='product_unit')
    op.drop_index(op.f('ix_product_unit_imei'), table_name='product_unit')
    op.drop_table('product_unit')

    op.drop_index(op.f('ix_location_name'), table_name='location')
    op.drop_table('location')

    sa.Enum(name='movementsourcetype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='movementtype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='productunitstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='locationtype').drop(op.get_bind(), checkfirst=True)
