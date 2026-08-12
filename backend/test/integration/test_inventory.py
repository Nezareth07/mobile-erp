"""Tests de integracion HTTP para /inventory (Etapa 6a).

Todos los endpoints estan guardados por require_permission. Igual patron
que test_customers.py: un usuario con exactamente los permisos
necesarios, armado con roles de un solo permiso cada uno via
create_role_with_permission (Etapa 4) -- sin tocar factories.py.

19 de los 20 casos usan `client`/`db_session` (SAVEPOINT, rollback
automatico). El caso #34 (orden FIFO real al ajustar stock) es la unica
excepcion: usa `live_client` con sesiones reales independientes por
request, porque `StockLot.received_at` tiene `server_default=now()`, y
Postgres resuelve `now()` como el instante de INICIO de la transaccion --
dentro de una misma transaccion (como la que envuelve `db_session`), dos
lotes creados en el mismo test recibirian el mismo `received_at`,
haciendo el orden FIFO indeterminado sin usar sleep(). Con `live_client`,
cada intake es una transaccion Postgres real y separada, así que el
segundo lote recibe un `received_at` genuinamente posterior al primero,
sin necesidad de sleep(). Limpieza manual explicita por id al final,
igual patron que test_concurrency_duplicate_email.py.

Sin mocks, sin sleep().
"""
from uuid import UUID, uuid4

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.inventory.models.stock_lot import StockLot
from app.modules.inventory.models.stock_movement import StockMovement
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.brand import Brand
from app.modules.product.models.category import Category
from app.modules.product.models.product import Product
from factories import create_product, create_role_with_permission, create_user

_INTAKE_SERIAL_URL = "/api/v1/inventory/intake/serial"
_INTAKE_BATCH_URL = "/api/v1/inventory/intake/batch"
_ADJUSTMENTS_URL = "/api/v1/inventory/adjustments"

_SEEDED_LOCATION_NAME = "Tienda Principal"
_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _issue_user_with_permissions(db_session, *permission_codes):
    roles = [
        await create_role_with_permission(db_session, code)
        for code in permission_codes
    ]
    user = await create_user(db_session, role_ids=[role.id for role in roles])
    headers = _bearer(JWTHandler.create_access_token(user.id))
    return user, headers


def _unique_imei() -> str:
    return str(uuid4().int)[:15]


def _stock_url(product_id) -> str:
    return f"/api/v1/inventory/products/{product_id}/stock"


def _units_url(product_id) -> str:
    return f"/api/v1/inventory/products/{product_id}/units"


def _by_imei_url(imei: str) -> str:
    return f"/api/v1/inventory/units/by-imei/{imei}"


# --- 15-18: intake serial ----------------------------------------------------


async def test_register_serial_intake_success_uses_seeded_location(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.intake")
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    response = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "imei": imei,
            "unit_cost": "150.00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["imei"] == imei
    assert body["status"] == "in_stock"
    assert body["location"]["name"] == _SEEDED_LOCATION_NAME


async def test_register_serial_intake_on_non_serial_product_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.intake")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "imei": _unique_imei(),
            "unit_cost": "150.00",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Product is not serial-tracked."


async def test_register_serial_intake_with_duplicate_imei_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.intake")
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    first = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={"product_id": str(product.id), "imei": imei, "unit_cost": "150.00"},
    )
    assert first.status_code == 201

    second = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={"product_id": str(product.id), "imei": imei, "unit_cost": "150.00"},
    )

    assert second.status_code == 409
    assert second.json()["detail"] == "IMEI already registered."


async def test_register_serial_intake_with_duplicate_imei2_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.intake")
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    shared_imei = _unique_imei()

    first = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "imei": shared_imei,
            "unit_cost": "150.00",
        },
    )
    assert first.status_code == 201

    second = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "imei": _unique_imei(),
            "imei2": shared_imei,
            "unit_cost": "150.00",
        },
    )

    assert second.status_code == 409
    assert second.json()["detail"] == "IMEI already registered."


# --- 19-20: intake batch ------------------------------------------------------


async def test_register_batch_intake_success(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.intake")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _INTAKE_BATCH_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "quantity": 10,
            "unit_cost": "5.50",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["quantity_received"] == 10
    assert body["quantity_available"] == 10


async def test_register_batch_intake_on_serial_product_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.intake")
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    response = await client.post(
        _INTAKE_BATCH_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "quantity": 10,
            "unit_cost": "5.50",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Product is serial-tracked; use serial intake instead."
    )


# --- 21-22: stock disponible --------------------------------------------------


async def test_get_available_stock_for_serial_product_counts_in_stock_units(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    for _ in range(3):
        await client.post(
            _INTAKE_SERIAL_URL,
            headers=headers,
            json={
                "product_id": str(product.id),
                "imei": _unique_imei(),
                "unit_cost": "100.00",
            },
        )

    response = await client.get(_stock_url(product.id), headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["tracking_type"] == "serial"
    assert body["available_quantity"] == 3


async def test_get_available_stock_for_batch_product_sums_lots(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    await client.post(
        _INTAKE_BATCH_URL,
        headers=headers,
        json={"product_id": str(product.id), "quantity": 4, "unit_cost": "5.00"},
    )
    await client.post(
        _INTAKE_BATCH_URL,
        headers=headers,
        json={"product_id": str(product.id), "quantity": 6, "unit_cost": "6.00"},
    )

    response = await client.get(_stock_url(product.id), headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["tracking_type"] == "batch"
    assert body["available_quantity"] == 10


# --- 23-24: listar unidades ----------------------------------------------------


async def test_list_units_for_serial_product_filters_by_status(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "imei": _unique_imei(),
            "unit_cost": "100.00",
        },
    )

    response = await client.get(
        _units_url(product.id),
        headers=headers,
        params={"status": "in_stock"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["status"] == "in_stock"


async def test_list_units_on_non_serial_product_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.read")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.get(_units_url(product.id), headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Product is not serial-tracked."


# --- 25-26: obtener unidad por imei --------------------------------------------


async def test_get_unit_by_imei_success(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={"product_id": str(product.id), "imei": imei, "unit_cost": "100.00"},
    )

    response = await client.get(_by_imei_url(imei), headers=headers)

    assert response.status_code == 200
    assert response.json()["imei"] == imei


async def test_get_unit_by_imei_not_found_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.read")

    response = await client.get(_by_imei_url(_unique_imei()), headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Product unit not found."


# --- 27-29: ajustes serial ------------------------------------------------------


async def test_adjust_serial_unit_status_changes_availability(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.adjust", "inventory.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={"product_id": str(product.id), "imei": imei, "unit_cost": "100.00"},
    )

    response = await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "out",
            "imei": imei,
            "new_status": "defective",
        },
    )

    assert response.status_code == 200
    assert response.json()["available_quantity"] == 0

    unit_response = await client.get(_by_imei_url(imei), headers=headers)
    assert unit_response.json()["status"] == "defective"


async def test_adjust_serial_unit_with_no_availability_change_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.adjust"
    )
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={"product_id": str(product.id), "imei": imei, "unit_cost": "100.00"},
    )
    await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "out",
            "imei": imei,
            "new_status": "defective",
        },
    )

    response = await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "out",
            "imei": imei,
            "new_status": "returned_to_supplier",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Adjustment does not change unit availability."
    )


async def test_adjust_serial_unit_without_imei_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.adjust"
    )
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    response = await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "out",
            "new_status": "defective",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "imei is required to adjust a serial-tracked product."
    )


# --- 30-32: ajustes batch --------------------------------------------------------


async def test_adjust_batch_stock_in_creates_new_lot(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.adjust", "inventory.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "in",
            "quantity": 8,
            "unit_cost": "3.00",
        },
    )

    assert response.status_code == 200
    assert response.json()["available_quantity"] == 8


async def test_adjust_batch_stock_out_with_insufficient_quantity_in_earliest_lot_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "inventory.intake", "inventory.adjust"
    )
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    await client.post(
        _INTAKE_BATCH_URL,
        headers=headers,
        json={"product_id": str(product.id), "quantity": 2, "unit_cost": "5.00"},
    )

    response = await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "out",
            "quantity": 5,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Not enough available stock in the earliest lot for this "
        "adjustment."
    )


async def test_adjust_batch_stock_out_with_no_stock_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.adjust")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _ADJUSTMENTS_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "direction": "out",
            "quantity": 1,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "No available stock to adjust."


# --- 33: wiring sanity -------------------------------------------------------


async def test_register_serial_intake_without_permission_returns_403(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "inventory.read")
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    response = await client.post(
        _INTAKE_SERIAL_URL,
        headers=headers,
        json={
            "product_id": str(product.id),
            "imei": _unique_imei(),
            "unit_cost": "100.00",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE


# --- 34: FIFO real, live_client, limpieza manual ---------------------------------


async def test_batch_adjustment_out_consumes_the_earliest_lot_first(live_client):
    """`StockLot.received_at` es `server_default=now()`, estable durante
    toda una transaccion Postgres -- dos lotes creados dentro del mismo
    `db_session` recibirian el mismo `received_at`. Aqui cada intake pasa
    por `live_client`, una transaccion Postgres real e independiente por
    request, asi que el segundo lote recibe un `received_at` genuinamente
    posterior sin necesidad de sleep(). `_adjust_lot_quantity` solo toca
    UN lote (el mas antiguo con stock disponible, sin repartir entre
    varios) -- por eso la aserccion clave es que el lote B (mas nuevo)
    queda intacto tras consumir del lote A.
    """
    product_id = None
    brand_id = None
    category_id = None
    role_ids: list = []
    user_id = None

    try:
        async with SessionFactory() as setup_session:
            product = await create_product(
                setup_session, tracking_type=TrackingType.BATCH
            )
            product_id = product.id
            brand_id = product.brand_id
            category_id = product.category_id

            role_intake = await create_role_with_permission(
                setup_session, "inventory.intake"
            )
            role_adjust = await create_role_with_permission(
                setup_session, "inventory.adjust"
            )
            role_ids = [role_intake.id, role_adjust.id]

            user = await create_user(
                setup_session, role_ids=role_ids
            )
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(user_id))

        lot_a_response = await live_client.post(
            _INTAKE_BATCH_URL,
            headers=headers,
            json={
                "product_id": str(product_id),
                "quantity": 5,
                "unit_cost": "10.00",
            },
        )
        assert lot_a_response.status_code == 201
        lot_a_id = UUID(lot_a_response.json()["id"])

        lot_b_response = await live_client.post(
            _INTAKE_BATCH_URL,
            headers=headers,
            json={
                "product_id": str(product_id),
                "quantity": 5,
                "unit_cost": "20.00",
            },
        )
        assert lot_b_response.status_code == 201
        lot_b_id = UUID(lot_b_response.json()["id"])

        adjust_response = await live_client.post(
            _ADJUSTMENTS_URL,
            headers=headers,
            json={
                "product_id": str(product_id),
                "direction": "out",
                "quantity": 3,
            },
        )
        assert adjust_response.status_code == 200

        async with SessionFactory() as verify_session:
            lot_a = await verify_session.get(StockLot, lot_a_id)
            lot_b = await verify_session.get(StockLot, lot_b_id)

            assert lot_a.received_at < lot_b.received_at
            assert lot_a.quantity_available == 2, (
                "El lote mas antiguo (A) debio consumirse primero: "
                f"5 - 3 = 2, obtuve {lot_a.quantity_available}"
            )
            assert lot_b.quantity_available == 5, (
                "El lote mas nuevo (B) no debio tocarse mientras A "
                f"todavia tenia stock, obtuve {lot_b.quantity_available}"
            )

    finally:
        async with SessionFactory() as cleanup_session:
            if product_id is not None:
                await cleanup_session.execute(
                    delete(StockMovement).where(
                        StockMovement.product_id == product_id
                    )
                )
                await cleanup_session.execute(
                    delete(StockLot).where(StockLot.product_id == product_id)
                )

            if user_id is not None:
                await cleanup_session.execute(
                    delete(UserRole).where(UserRole.user_id == user_id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id == user_id)
                )

            if role_ids:
                # role_permission tiene ondelete="CASCADE" sobre role_id,
                # asi que borrar el Role basta para limpiar sus permisos
                # asignados.
                await cleanup_session.execute(
                    delete(Role).where(Role.id.in_(role_ids))
                )

            if product_id is not None:
                await cleanup_session.execute(
                    delete(Product).where(Product.id == product_id)
                )

            if category_id is not None:
                await cleanup_session.execute(
                    delete(Category).where(Category.id == category_id)
                )

            if brand_id is not None:
                await cleanup_session.execute(
                    delete(Brand).where(Brand.id == brand_id)
                )

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            if product_id is not None:
                remaining_lots = await check_session.execute(
                    select(StockLot).where(StockLot.product_id == product_id)
                )
                assert remaining_lots.scalars().all() == []

                remaining_movements = await check_session.execute(
                    select(StockMovement).where(
                        StockMovement.product_id == product_id
                    )
                )
                assert remaining_movements.scalars().all() == []

                remaining_product = await check_session.get(Product, product_id)
                assert remaining_product is None

            if user_id is not None:
                remaining_user = await check_session.get(User, user_id)
                assert remaining_user is None

            for role_id in role_ids:
                remaining_role = await check_session.get(Role, role_id)
                assert remaining_role is None
