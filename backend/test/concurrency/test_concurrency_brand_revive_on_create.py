"""Carrera real BUG #002: dos POST /brands simultaneos con el mismo nombre
de una marca previamente desactivada (revive-on-create).

`BrandService.create_brand` no usa ningun lock de aplicacion. Cuando la
fila existe pero esta inactiva, ambas transacciones concurrentes la
encuentran via `get_by_name` y ambas ejecutan `UPDATE brand SET
is_active = true` sobre la MISMA fila -- Postgres serializa por lock de
fila y el valor es idempotente, asi que el resultado es una unica fila
activa con el UUID original, nunca una segunda fila. El indice unico
`ix_brand_name` sigue siendo el arbitro final para el caso de INSERT
concurrente (nombre que aun no existe), reutilizando el handler global
de IntegrityError -> 409 que ya tiene la app.

Sin sleep(), sin mocks: concurrencia real via asyncio.gather contra
`live_client` (sesiones/transacciones Postgres independientes por
request). Limpieza manual explicita por id/nombre, verificada al final.
"""
import asyncio

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.product.models.brand import Brand
from app.modules.product.services.brand_service import BrandService
from factories import create_brand, create_role_with_permission, create_user

_BRANDS_URL = "/api/v1/brands"
_RACE_NAME = "concurrency-revive-on-create-brand"


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_two_concurrent_recreates_of_an_inactive_brand_revive_one_row(
    live_client,
):
    brand_id = None
    role_id = None
    user_id = None

    try:
        # --- setup real, comiteado de verdad (SessionFactory, no db_session):
        # una marca creada y luego desactivada (soft-delete) ---
        async with SessionFactory() as setup_session:
            brand = await create_brand(setup_session, name=_RACE_NAME)
            brand_id = brand.id
            await BrandService(setup_session).delete_brand(brand_id)

            role = await create_role_with_permission(
                setup_session, "brands.create"
            )
            role_id = role.id

            user = await create_user(setup_session, role_ids=[role_id])
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(user_id))

        # --- carrera real, sin sleep(): dos POST al mismo tiempo, mismo
        # nombre, contra la fila inactiva ---
        results = await asyncio.gather(
            live_client.post(
                _BRANDS_URL, headers=headers, json={"name": _RACE_NAME}
            ),
            live_client.post(
                _BRANDS_URL, headers=headers, json={"name": _RACE_NAME}
            ),
        )

        statuses = sorted(r.status_code for r in results)
        print(f"\n[BUG#002 revive race -- statuses observados] {statuses}")

        # Ningun request debe terminar en 500. Segun si las dos
        # transacciones se solapan o no, se obtiene [201, 201] (ambas
        # reactivan la misma fila, UPDATE idempotente) o [201, 409] (si el
        # motor serializa de forma que la segunda ve la fila ya activa y
        # cae en el ConflictException de siempre). Lo unico inaceptable es
        # un 500 o que aparezca una segunda fila.
        assert all(r.status_code != 500 for r in results), (
            f"ningun request deberia terminar en 500, se obtuvo {statuses}"
        )
        assert statuses in ([201, 201], [201, 409]), (
            f"combinacion de status inesperada: {statuses}"
        )

        # Invariante: exactamente una fila con ese nombre, activa, con el
        # UUID original. Se verifica con una conexion nueva y separada.
        async with SessionFactory() as verify_session:
            rows = (
                (
                    await verify_session.execute(
                        select(Brand).where(Brand.name == _RACE_NAME)
                    )
                )
                .scalars()
                .all()
            )

            assert len(rows) == 1, (
                f"esperaba exactamente 1 fila '{_RACE_NAME}', hay {len(rows)}"
            )
            assert rows[0].id == brand_id, (
                "la fila reactivada debe conservar el UUID original"
            )
            assert rows[0].is_active is True

    finally:
        # --- limpieza explicita ---
        async with SessionFactory() as cleanup_session:
            if brand_id is not None:
                await cleanup_session.execute(
                    delete(Brand).where(Brand.name == _RACE_NAME)
                )
            if user_id is not None:
                await cleanup_session.execute(
                    delete(UserRole).where(UserRole.user_id == user_id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id == user_id)
                )
            if role_id is not None:
                # role_permission.role_id es ON DELETE CASCADE
                await cleanup_session.execute(
                    delete(Role).where(Role.id == role_id)
                )
            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            remaining = (
                (
                    await check_session.execute(
                        select(Brand).where(Brand.name == _RACE_NAME)
                    )
                )
                .scalars()
                .all()
            )
            assert remaining == []
