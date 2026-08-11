"""create admin role

Revision ID: 38e1e436dec5
Revises: 2498e99f528b
Create Date: 2026-08-11 00:08:17.338232

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38e1e436dec5'
down_revision: Union[str, Sequence[str], None] = '2498e99f528b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_NAME = 'ADMIN'
ROLE_DESCRIPTION = 'Full system access — all permissions granted'


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    role_id = uuid.uuid4()

    bind.execute(
        sa.text(
            "INSERT INTO role (id, name, description, is_active) "
            "VALUES (:id, :name, :description, :is_active)"
        ).bindparams(
            id=role_id,
            name=ROLE_NAME,
            description=ROLE_DESCRIPTION,
            is_active=True,
        )
    )

    # Asignar dinamicamente TODOS los Permission existentes al momento de
    # aplicar esta migracion -- nunca se hardcodean codigos ni UUIDs, porque
    # los id de permission se generan con uuid.uuid4() en cada instalacion
    # (8f785625aa88_create_auth_tables.py) y son distintos por entorno.
    permission_ids = bind.execute(
        sa.text("SELECT id FROM permission")
    ).scalars().all()

    for permission_id in permission_ids:
        bind.execute(
            sa.text(
                "INSERT INTO role_permission (id, role_id, permission_id) "
                "VALUES (:id, :role_id, :permission_id)"
            ).bindparams(
                id=uuid.uuid4(),
                role_id=role_id,
                permission_id=permission_id,
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    role_id = bind.execute(
        sa.text("SELECT id FROM role WHERE name = :name").bindparams(
            name=ROLE_NAME
        )
    ).scalar_one_or_none()

    if role_id is None:
        return

    # fk_user_role_role_id_role tiene ondelete='CASCADE' (definido en la
    # migracion de auth ya committeada, que no se modifica). Eso significa
    # que un DELETE FROM role NO falla por integridad referencial aunque
    # existan UserRole apuntando a esta fila -- cascadearia y borraria la
    # asignacion de un usuario real en silencio. Por eso el chequeo se hace
    # explicitamente aca, antes de borrar nada.
    assigned_users = bind.execute(
        sa.text(
            "SELECT count(*) FROM user_role WHERE role_id = :role_id"
        ).bindparams(role_id=role_id)
    ).scalar_one()

    if assigned_users > 0:
        raise RuntimeError(
            f"Cannot downgrade: {assigned_users} user(s) still have the "
            "'ADMIN' role assigned. Remove those role assignments before "
            "downgrading this migration."
        )

    bind.execute(
        sa.text(
            "DELETE FROM role_permission WHERE role_id = :role_id"
        ).bindparams(role_id=role_id)
    )

    bind.execute(
        sa.text("DELETE FROM role WHERE id = :role_id").bindparams(
            role_id=role_id
        )
    )
