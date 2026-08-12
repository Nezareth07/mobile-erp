"""Validacion de la fixture `live_client` + primer test permanente de
concurrencia real: dos POST /api/v1/users concurrentes con el mismo
email, disparados con asyncio.gather (sin sleep()) contra la app real,
sin el override de get_session.

Este archivo demuestra tres cosas a la vez, deliberadamente:
1. live_client funciona contra sesiones independientes reales (no la
   sesion aislada de db_session -- este test NUNCA pide db_session).
2. La invariante de negocio (un email, un usuario) se sostiene bajo
   concurrencia real, no solo en el caso feliz secuencial.
3. La limpieza es explicita y por id, no por patron de texto.
"""
import asyncio

from sqlalchemy import delete, select, text

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.services.role_service import RoleService
from app.modules.auth.services.user_service import UserService
from app.modules.auth.schemas.user_create import UserCreate

_RACE_EMAIL = "concurrency-duplicate-email@mobileerp-test.dev"


async def test_live_client_uses_real_independent_sessions_not_the_isolated_one(
    live_client,
):
    # --- setup: admin real, creado con su propia sesion que comitea de
    # verdad (SessionFactory, no db_session) ---
    async with SessionFactory() as setup_session:
        role_service = RoleService(setup_session)
        roles = await role_service.get_roles()
        admin_role = next(r for r in roles if r.name == "ADMIN")

        user_service = UserService(setup_session)
        admin = await user_service.create_user(
            UserCreate(
                email="concurrency-setup-admin@mobileerp-test.dev",
                full_name="Concurrency Setup Admin",
                password="Sup3rSecretQA!",
                role_ids=[admin_role.id],
            )
        )

    try:
        login = await live_client.post(
            "/api/v1/auth/login",
            json={
                "email": "concurrency-setup-admin@mobileerp-test.dev",
                "password": "Sup3rSecretQA!",
            },
        )
        assert login.status_code == 200
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        # --- prueba de concurrencia real, sin sleep(): dos requests al
        # mismo tiempo, mismo email ---
        results = await asyncio.gather(
            live_client.post(
                "/api/v1/users",
                headers=headers,
                json={
                    "email": _RACE_EMAIL,
                    "full_name": "Race One",
                    "password": "Sup3rSecretQA!",
                    "role_ids": [],
                },
            ),
            live_client.post(
                "/api/v1/users",
                headers=headers,
                json={
                    "email": _RACE_EMAIL,
                    "full_name": "Race Two",
                    "password": "Sup3rSecretQA!",
                    "role_ids": [],
                },
            ),
        )

        statuses = sorted(r.status_code for r in results)
        assert statuses == [201, 409], (
            f"esperaba exactamente un 201 y un 409, obtuve {statuses}"
        )
        assert all(r.status_code != 500 for r in results)

        # --- prueba de que live_client NO paso por la sesion aislada:
        # se verifica con una conexion nueva y completamente separada,
        # sin pasar por ningun fixture -- si los datos existen aca, es
        # porque de verdad se comitearon a Postgres, no a un SAVEPOINT
        # que este test pudiera estar viendo por accidente. ---
        async with SessionFactory() as verify_session:
            result = await verify_session.execute(
                select(User).where(User.email == _RACE_EMAIL)
            )
            rows = result.scalars().all()
            assert len(rows) == 1, (
                f"esperaba exactamente 1 fila persistida, encontre {len(rows)}"
            )
            created_race_user_id = rows[0].id

    finally:
        # --- limpieza explicita por id, no por patron de texto ---
        async with SessionFactory() as cleanup_session:
            race_user = (
                await cleanup_session.execute(
                    select(User).where(User.email == _RACE_EMAIL)
                )
            ).scalar_one_or_none()

            ids_to_delete = [admin.id]
            if race_user is not None:
                ids_to_delete.append(race_user.id)

            await cleanup_session.execute(
                delete(UserRole).where(UserRole.user_id.in_(ids_to_delete))
            )
            await cleanup_session.execute(
                delete(User).where(User.id.in_(ids_to_delete))
            )
            await cleanup_session.commit()

        # confirma que la limpieza realmente funciono
        async with SessionFactory() as check_session:
            remaining = await check_session.execute(
                select(User).where(User.id.in_(ids_to_delete))
            )
            assert remaining.scalars().all() == []
