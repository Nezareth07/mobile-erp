"""Carrera real: los dos unicos ADMIN activos intentan desactivarse
mutuamente al mismo tiempo (Etapa 7, carrera 2 de 3).

`UserService._ensure_not_last_active_admin` adquiere
`pg_advisory_xact_lock` (clave fija `_ADMIN_LOCKOUT_LOCK_KEY`) ANTES de
contar administradores activos, y se invoca desde `deactivate_user`
cuando el usuario afectado sostiene el rol ADMIN activo. Con exactamente
2 ADMIN activos, dos DELETE concurrentes (cada admin desactivando al
otro) deberian quedar serializados por ese lock: el primero en
adquirirlo cuenta 2, pasa, desactiva y comitea; el segundo, al adquirir
el lock despues, cuenta 1 (el otro ya se desactivo) y es rechazado.

admin1/admin2 se crean via `create_user(role_ids=[admin_role.id])`, NO
via `create_admin()`/`bootstrap_admin` -- ese ultimo es idempotente y
devuelve el ADMIN existente en vez de crear uno nuevo, lo que impediria
tener 2 administradores distintos.

Sin sleep(), sin mocks: concurrencia real via asyncio.gather contra
`live_client`. Limpieza manual explicita por id, verificada al final.
"""
import asyncio

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.repositories.role_repository import RoleRepository
from app.modules.auth.security.jwt_handler import JWTHandler
from factories import create_user

_USERS_URL = "/api/v1/users"
_LAST_ADMIN_MESSAGE = (
    "This operation would leave the system without any active ADMIN user."
)


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_two_last_admins_racing_to_deactivate_each_other_leaves_exactly_one(
    live_client,
):
    admin1_id = None
    admin2_id = None

    try:
        async with SessionFactory() as setup_session:
            admin_role = await RoleRepository(setup_session).get_by_name("ADMIN")
            assert admin_role is not None, (
                "El rol ADMIN sembrado por la migracion no esta presente "
                "-- precondicion de la suite rota."
            )

            admin1 = await create_user(setup_session, role_ids=[admin_role.id])
            admin1_id = admin1.id

            admin2 = await create_user(setup_session, role_ids=[admin_role.id])
            admin2_id = admin2.id

        headers1 = _bearer(JWTHandler.create_access_token(admin1_id))
        headers2 = _bearer(JWTHandler.create_access_token(admin2_id))

        # admin1 desactiva a admin2, admin2 desactiva a admin1 -- concurrente.
        results = await asyncio.gather(
            live_client.delete(f"{_USERS_URL}/{admin2_id}", headers=headers1),
            live_client.delete(f"{_USERS_URL}/{admin1_id}", headers=headers2),
        )

        statuses = sorted(r.status_code for r in results)
        assert statuses == [204, 400], (
            f"Se esperaba exactamente un 204 y un 400 (el advisory lock "
            f"serializa las dos llamadas a "
            f"_ensure_not_last_active_admin), se obtuvo {statuses}"
        )

        rejected = next(r for r in results if r.status_code == 400)
        assert rejected.json()["detail"] == _LAST_ADMIN_MESSAGE

        async with SessionFactory() as verify_session:
            active_admins = await verify_session.execute(
                select(User).where(
                    User.id.in_([admin1_id, admin2_id]),
                    User.is_active.is_(True),
                )
            )
            remaining = active_admins.scalars().all()

            assert len(remaining) == 1, (
                "Invariante violada: se esperaba que quedara exactamente "
                f"1 ADMIN activo entre admin1/admin2 tras la carrera, "
                f"quedaron {len(remaining)}"
            )

    finally:
        async with SessionFactory() as cleanup_session:
            for user_id in (admin1_id, admin2_id):
                if user_id is not None:
                    await cleanup_session.execute(
                        delete(UserRole).where(UserRole.user_id == user_id)
                    )
                    await cleanup_session.execute(
                        delete(User).where(User.id == user_id)
                    )

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            for user_id in (admin1_id, admin2_id):
                if user_id is not None:
                    assert await check_session.get(User, user_id) is None
