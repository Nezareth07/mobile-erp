"""Carrera real: dos clientes distintos intentan volverse el cliente
default al mismo tiempo (Etapa 7, carrera 1 de 3).

`CustomerService.set_default_customer` no usa ningun lock de aplicacion
-- la integridad depende exclusivamente del indice unico parcial
`uq_customer_default_active` (WHERE is_default_customer IS TRUE AND
is_active IS TRUE). Bajo READ COMMITTED, dos transacciones concurrentes
que arrancan sin ningun default previo comiteado ven ambas
`get_default() is None` y ambas intentan poner su propio cliente en
True -- el indice unico es el arbitro real, no la aplicacion.

Sin sleep(), sin mocks: concurrencia real via asyncio.gather contra
`live_client` (sesiones/transacciones Postgres independientes por
request). Limpieza manual explicita por id, verificada al final.
"""
import asyncio

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.customer.models.customer import Customer
from factories import create_customer, create_role_with_permission, create_user

_CUSTOMERS_URL = "/api/v1/customers"


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def test_two_customers_racing_to_become_default_resolve_to_exactly_one(
    live_client,
):
    customer_a_id = None
    customer_b_id = None
    role_id = None
    user_id = None

    try:
        async with SessionFactory() as setup_session:
            customer_a = await create_customer(setup_session)
            customer_a_id = customer_a.id

            customer_b = await create_customer(setup_session)
            customer_b_id = customer_b.id

            role = await create_role_with_permission(
                setup_session, "customers.manage_default"
            )
            role_id = role.id

            user = await create_user(setup_session, role_ids=[role_id])
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(user_id))

        results = await asyncio.gather(
            live_client.put(
                f"{_CUSTOMERS_URL}/{customer_a_id}/default", headers=headers
            ),
            live_client.put(
                f"{_CUSTOMERS_URL}/{customer_b_id}/default", headers=headers
            ),
        )

        statuses = sorted(r.status_code for r in results)
        print(f"\n[Carrera 1 -- resultado real observado] statuses={statuses}")

        # No se asume una combinacion fija de status codes: si las dos
        # transacciones realmente se solapan, la segunda choca contra el
        # indice unico parcial y se obtiene [200, 409]; si no se solapan
        # (una termina antes de que la otra arranque), la propia logica de
        # `set_default_customer` (leer el default actual y desactivarlo)
        # tambien preserva el invariante y se obtiene [200, 200]. Lo unico
        # que NO deberia pasar nunca es un 500 -- eso si seria un defecto.
        assert all(r.status_code != 500 for r in results), (
            f"Ningun request deberia terminar en 500, se obtuvo {statuses}"
        )
        assert statuses in ([200, 200], [200, 409]), (
            f"Combinacion de status inesperada: {statuses}"
        )

        async with SessionFactory() as verify_session:
            defaults = await verify_session.execute(
                select(Customer).where(
                    Customer.id.in_([customer_a_id, customer_b_id]),
                    Customer.is_default_customer.is_(True),
                )
            )
            defaulted = defaults.scalars().all()

            assert len(defaulted) == 1, (
                "Invariante violada: se esperaba exactamente un cliente "
                f"default entre A y B tras la carrera, se encontraron "
                f"{len(defaulted)}"
            )

    finally:
        async with SessionFactory() as cleanup_session:
            for customer_id in (customer_a_id, customer_b_id):
                if customer_id is not None:
                    await cleanup_session.execute(
                        delete(Customer).where(Customer.id == customer_id)
                    )

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

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            for customer_id in (customer_a_id, customer_b_id):
                if customer_id is not None:
                    assert await check_session.get(Customer, customer_id) is None
            if user_id is not None:
                assert await check_session.get(User, user_id) is None
            if role_id is not None:
                assert await check_session.get(Role, role_id) is None
