"""create auth tables

Revision ID: 8f785625aa88
Revises: 600a4a2a69ac
Create Date: 2026-08-10 21:59:24.233542

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f785625aa88'
down_revision: Union[str, Sequence[str], None] = '600a4a2a69ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERMISSIONS = [
    ('brands.create', 'Create brands'),
    ('brands.read', 'Read brands'),
    ('brands.update', 'Update brands'),
    ('brands.delete', 'Deactivate brands'),
    ('categories.create', 'Create categories'),
    ('categories.read', 'Read categories'),
    ('categories.update', 'Update categories'),
    ('categories.delete', 'Deactivate categories'),
    ('products.create', 'Create products'),
    ('products.read', 'Read products'),
    ('products.update', 'Update products'),
    ('products.delete', 'Deactivate products'),
    ('suppliers.create', 'Create suppliers'),
    ('suppliers.read', 'Read suppliers'),
    ('suppliers.update', 'Update suppliers'),
    ('suppliers.delete', 'Deactivate suppliers'),
    ('customers.create', 'Create customers'),
    ('customers.read', 'Read customers'),
    ('customers.update', 'Update customers'),
    ('customers.delete', 'Deactivate customers'),
    ('inventory.read', 'Read stock, units and movements'),
    ('inventory.intake', 'Register serial or batch stock intake'),
    ('inventory.adjust', 'Perform manual inventory adjustments'),
    ('purchases.create', 'Register purchases'),
    ('purchases.read', 'Read purchases'),
    ('sales.create', 'Register sales'),
    ('sales.read', 'Read sales'),
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'permission',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_permission')),
    )
    op.create_index(
        op.f('ix_permission_code'), 'permission', ['code'], unique=True
    )

    op.create_table(
        'role',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
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
        sa.PrimaryKeyConstraint('id', name=op.f('pk_role')),
    )
    op.create_index(op.f('ix_role_name'), 'role', ['name'], unique=True)

    op.create_table(
        'user',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
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
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user')),
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)

    op.create_table(
        'role_permission',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('role_id', sa.Uuid(), nullable=False),
        sa.Column('permission_id', sa.Uuid(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['permission_id'],
            ['permission.id'],
            name=op.f('fk_role_permission_permission_id_permission'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['role_id'],
            ['role.id'],
            name=op.f('fk_role_permission_role_id_role'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_role_permission')),
        sa.UniqueConstraint(
            'role_id',
            'permission_id',
            name='uq_role_permission_role_id_permission_id',
        ),
    )
    op.create_index(
        op.f('ix_role_permission_permission_id'),
        'role_permission',
        ['permission_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_role_permission_role_id'),
        'role_permission',
        ['role_id'],
        unique=False,
    )

    op.create_table(
        'user_role',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('role_id', sa.Uuid(), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ['role_id'],
            ['role.id'],
            name=op.f('fk_user_role_role_id_role'),
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['user.id'],
            name=op.f('fk_user_role_user_id_user'),
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_user_role')),
        sa.UniqueConstraint(
            'user_id', 'role_id', name='uq_user_role_user_id_role_id'
        ),
    )
    op.create_index(
        op.f('ix_user_role_role_id'), 'user_role', ['role_id'], unique=False
    )
    op.create_index(
        op.f('ix_user_role_user_id'), 'user_role', ['user_id'], unique=False
    )

    # Permission records de referencia del sistema (ver docs/api-conventions.md
    # y la matriz de permisos aprobada en Paso 7). Mismo patron que el seed de
    # Location en 879831f26f89_create_inventory_tables.py.
    for code, description in PERMISSIONS:
        op.execute(
            sa.text(
                "INSERT INTO permission (id, code, description) "
                "VALUES (:id, :code, :description)"
            ).bindparams(
                id=uuid.uuid4(),
                code=code,
                description=description,
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_user_role_user_id'), table_name='user_role')
    op.drop_index(op.f('ix_user_role_role_id'), table_name='user_role')
    op.drop_table('user_role')

    op.drop_index(
        op.f('ix_role_permission_role_id'), table_name='role_permission'
    )
    op.drop_index(
        op.f('ix_role_permission_permission_id'),
        table_name='role_permission',
    )
    op.drop_table('role_permission')

    op.drop_index(op.f('ix_user_email'), table_name='user')
    op.drop_table('user')

    op.drop_index(op.f('ix_role_name'), table_name='role')
    op.drop_table('role')

    op.drop_index(op.f('ix_permission_code'), table_name='permission')
    op.drop_table('permission')
