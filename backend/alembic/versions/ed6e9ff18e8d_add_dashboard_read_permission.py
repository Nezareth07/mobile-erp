"""add dashboard read permission

Revision ID: ed6e9ff18e8d
Revises: 38e1e436dec5
Create Date: 2026-08-12 15:50:51.227951

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed6e9ff18e8d'
down_revision: Union[str, Sequence[str], None] = '38e1e436dec5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PERMISSION_CODE = 'dashboard.read'
PERMISSION_DESCRIPTION = 'Read consolidated dashboard KPIs and metrics'
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

    # El seed dinamico de todos los permisos al rol ADMIN
    # (38e1e436dec5_create_admin_role.py) corrio una sola vez, en ese
    # momento -- un permiso creado despues no llega a ADMIN automaticamente.
    # Se otorga aqui explicitamente, igual que alli: nunca se hardcodea el
    # id del rol, se busca por nombre en el momento de aplicar la migracion.
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
    # (ya committeada, no se modifica) -- el DELETE FROM permission de abajo
    # ya se encarga de limpiar role_permission. No hay chequeo de "en uso"
    # como en 38e1e436dec5_create_admin_role.py porque un Permission, a
    # diferencia de un Role, no tiene ningun estado de negocio que perder:
    # ninguna fila fuera de role_permission lo referencia.
    bind.execute(
        sa.text("DELETE FROM permission WHERE id = :id").bindparams(
            id=permission_id
        )
    )
