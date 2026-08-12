"""add reports read permission

Revision ID: 889315747bcb
Revises: 0d58091f77c3
Create Date: 2026-08-12 16:30:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '889315747bcb'
down_revision: Union[str, Sequence[str], None] = '0d58091f77c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERMISSION_CODE = 'reports.read'
PERMISSION_DESCRIPTION = (
    'Read business reports across sales, purchases and inventory'
)
ADMIN_ROLE_NAME = 'ADMIN'


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    permission_id = uuid.uuid4()

    bind.execute(
        sa.text(
            "INSERT INTO permission (id, code, description) "
            "VALUES (:id, :code, :description)"
        ).bindparams(
            id=permission_id,
            code=PERMISSION_CODE,
            description=PERMISSION_DESCRIPTION,
        )
    )

    # Mismo patron que ed6e9ff18e8d_add_dashboard_read_permission.py: el
    # seed dinamico de todos los permisos al rol ADMIN
    # (38e1e436dec5_create_admin_role.py) corrio una sola vez, en ese
    # momento -- un permiso creado despues no llega a ADMIN automaticamente.
    # Se otorga aqui explicitamente, buscando el rol por nombre en el
    # momento de aplicar la migracion, nunca por id hardcodeado.
    admin_role_id = bind.execute(
        sa.text("SELECT id FROM role WHERE name = :name").bindparams(
            name=ADMIN_ROLE_NAME
        )
    ).scalar_one_or_none()

    if admin_role_id is not None:
        bind.execute(
            sa.text(
                "INSERT INTO role_permission (id, role_id, permission_id) "
                "VALUES (:id, :role_id, :permission_id)"
            ).bindparams(
                id=uuid.uuid4(),
                role_id=admin_role_id,
                permission_id=permission_id,
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    permission_id = bind.execute(
        sa.text("SELECT id FROM permission WHERE code = :code").bindparams(
            code=PERMISSION_CODE
        )
    ).scalar_one_or_none()

    if permission_id is None:
        return

    # fk_role_permission_permission_id_permission tiene ondelete='CASCADE'
    # -- el DELETE FROM permission de abajo ya limpia role_permission. Sin
    # chequeo de "en uso" (a diferencia de 38e1e436dec5_create_admin_role.py)
    # porque un Permission no tiene ningun estado de negocio propio que
    # perder: ninguna fila fuera de role_permission lo referencia.
    bind.execute(
        sa.text("DELETE FROM permission WHERE id = :id").bindparams(
            id=permission_id
        )
    )
