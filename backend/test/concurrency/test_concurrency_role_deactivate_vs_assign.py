"""Carrera de roles: desactivar un rol mientras se le asigna a un usuario
activo, al mismo tiempo (Etapa 7, carrera 3 de 3).

Desde 2c291ec, `RoleService.deactivate_role` (via
`RoleRepository.get_for_update`) y `UserService._resolve_roles` (via
`RoleRepository.get_by_ids_for_update`) adquieren ambos un
`SELECT ... FOR UPDATE` sobre la misma fila `role`, serializando esta
carrera a nivel de Postgres: una de las dos transacciones espera a que
la otra libere el lock antes de leer `is_active` / `has_active_users`,
por lo que ya no hay ventana de lectura obsoleta entre ambas rutas.

Este test verifica el invariante ("ningun usuario activo deberia
terminar con un rol inactivo asignado") contra el estado real tras
la carrera, en lugar de asumir un codigo de estado fijo para cada
rama concurrente. Con el lock en su lugar, el invariante se sostiene
de forma consistente; el test se deja en esta forma (verificacion de
invariante, no de codigos de estado) porque documenta la garantia real
sin acoplarse a los codigos exactos que Postgres asigne a cada rama.

Sin sleep(), sin mocks: concurrencia real via asyncio.gather contra
`live_client`. Limpieza manual explicita por id, verificada al final.
"""
import asyncio

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.repositories.role_repository import RoleRepository
from app.modules.auth.security.jwt_handler import JWTHandler
from factories import create_role, create_user

_ROLES_URL = "/api/v1/roles"
_USERS_URL = "/api/v1/users"


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_deactivating_a_role_while_assigning_it_does_not_leave_an_active_user_with_an_inactive_role(
    live_client,
):
    admin_id = None
    role_id = None
    user_id = None

    try:
        async with SessionFactory() as setup_session:
            admin_role = await RoleRepository(setup_session).get_by_name("ADMIN")
            assert admin_role is not None

            admin = await create_user(setup_session, role_ids=[admin_role.id])
            admin_id = admin.id

            role = await create_role(setup_session)
            role_id = role.id

            user = await create_user(setup_session)
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(admin_id))

        results = await asyncio.gather(
            live_client.delete(f"{_ROLES_URL}/{role_id}", headers=headers),
            live_client.put(
                f"{_USERS_URL}/{user_id}/roles",
                headers=headers,
                json={"role_ids": [str(role_id)]},
            ),
        )

        deactivate_status = results[0].status_code
        assign_status = results[1].status_code

        print(
            "\n[Carrera 3 -- resultado real observado] "
            f"DELETE /roles/{{id}} -> {deactivate_status}, "
            f"PUT /users/{{id}}/roles -> {assign_status}"
        )

        async with SessionFactory() as verify_session:
            role_fresh = await verify_session.get(Role, role_id)

            user_role_row = await verify_session.execute(
                select(UserRole).where(
                    UserRole.user_id == user_id,
                    UserRole.role_id == role_id,
                )
            )
            role_is_assigned = user_role_row.scalar_one_or_none() is not None

            invariant_violated = (
                role_fresh.is_active is False
                and role_is_assigned
            )

            print(
                "[Carrera 3 -- estado final] "
                f"role.is_active={role_fresh.is_active}, "
                f"role_assigned_to_user={role_is_assigned}"
            )

            assert not invariant_violated, (
                "HALLAZGO: bajo esta ejecucion real, el usuario activo "
                f"{user_id} quedo con el rol {role_id} asignado mientras "
                "ese rol esta is_active=False -- invariante 'usuario "
                "activo -> rol activo' violada. No corregido en esta "
                "etapa; reportar antes de cualquier cambio de produccion."
            )

    finally:
        async with SessionFactory() as cleanup_session:
            if user_id is not None:
                await cleanup_session.execute(
                    delete(UserRole).where(UserRole.user_id == user_id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id == user_id)
                )

            if role_id is not None:
                await cleanup_session.execute(
                    delete(Role).where(Role.id == role_id)
                )

            if admin_id is not None:
                await cleanup_session.execute(
                    delete(UserRole).where(UserRole.user_id == admin_id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id == admin_id)
                )

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            if user_id is not None:
                assert await check_session.get(User, user_id) is None
            if role_id is not None:
                assert await check_session.get(Role, role_id) is None
            if admin_id is not None:
                assert await check_session.get(User, admin_id) is None
