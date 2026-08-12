"""Tests de integracion HTTP para /purchases (Etapa 6b).

Todos los endpoints estan guardados por require_permission -- mismo
patron que test_customers.py/test_inventory.py: un usuario con
exactamente los permisos necesarios via create_role_with_permission
(Etapa 4), sin tocar factories.py.

16 de los 17 casos usan `client`/`db_session`. El caso #51 (atomicidad)
usa `live_client` con limpieza manual -- ver su docstring para el porque:
`PurchaseService._validate_lines` valida TODAS las lineas de la compra
por completo (existencia, activo, cantidades, IMEIs) antes de escribir
ninguna fila, asi que no existe un camino determinista, no concurrente,
donde una linea ya volcada a la sesion sobreviva mientras otra falla
despues -- la validacion front-loaded ya lo impide por diseno. Por eso
#51 prueba atomicidad en su forma positiva: una compra multi-linea real,
via una sesion de produccion genuina (`live_client`), persiste TODOS sus
efectos juntos en un solo commit.

Sin mocks, sin sleep().
"""
from uuid import UUID, uuid4

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.inventory.models.product_unit import ProductUnit
from app.modules.inventory.models.stock_lot import StockLot
from app.modules.inventory.models.stock_movement import StockMovement
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.brand import Brand
from app.modules.product.models.category import Category
from app.modules.product.models.product import Product
from app.modules.product.services.product_service import ProductService
from app.modules.purchase.models.purchase import Purchase
from app.modules.supplier.models.supplier import Supplier
from app.modules.supplier.services.supplier_service import SupplierService
from factories import (
    create_product,
    create_role_with_permission,
    create_supplier,
    create_user,
)

_PURCHASES_URL = "/api/v1/purchases"

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


def _batch_line(product_id, quantity=10, unit_cost="5.00") -> dict:
    return {
        "product_id": str(product_id),
        "quantity": quantity,
        "unit_cost": unit_cost,
    }


def _serial_line(product_id, imei=None, unit_cost="150.00") -> dict:
    return {
        "product_id": str(product_id),
        "quantity": 1,
        "unit_cost": unit_cost,
        "imei": imei or _unique_imei(),
    }


# --- 35-37: creacion exitosa ------------------------------------------------


async def test_create_purchase_success_batch_line(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_batch_line(product.id)],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "confirmed"
    assert len(body["lines"]) == 1
    assert body["lines"][0]["quantity"] == 10


async def test_create_purchase_success_serial_line(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_serial_line(product.id, imei=imei)],
        },
    )

    assert response.status_code == 201
    assert response.json()["lines"][0]["imei"] == imei


async def test_create_purchase_success_mixed_lines(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    serial_product = await create_product(
        db_session, tracking_type=TrackingType.SERIAL
    )
    batch_product = await create_product(
        db_session, tracking_type=TrackingType.BATCH
    )

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [
                _serial_line(serial_product.id),
                _batch_line(batch_product.id),
            ],
        },
    )

    assert response.status_code == 201
    assert len(response.json()["lines"]) == 2


# --- 38-39: proveedor ---------------------------------------------------------


async def test_create_purchase_with_nonexistent_supplier_returns_404(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(uuid4()),
            "lines": [_batch_line(product.id)],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Supplier not found."


async def test_create_purchase_with_inactive_supplier_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    await SupplierService(db_session).delete_supplier(supplier.id)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_batch_line(product.id)],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Supplier is not active."


# --- 40-46: validacion de lineas -----------------------------------------------


async def test_create_purchase_with_nonexistent_product_returns_404(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    missing_product_id = uuid4()

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_batch_line(missing_product_id)],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Product {missing_product_id} not found."


async def test_create_purchase_with_inactive_product_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await ProductService(db_session).delete_product(product.id)

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_batch_line(product.id)],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == f"Product {product.id} is not active."


async def test_create_purchase_serial_line_with_quantity_other_than_one_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    line = _serial_line(product.id)
    line["quantity"] = 2

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={"supplier_id": str(supplier.id), "lines": [line]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Serial-tracked lines must have quantity=1."


async def test_create_purchase_serial_line_without_imei_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [
                {"product_id": str(product.id), "quantity": 1, "unit_cost": "100.00"}
            ],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "imei is required for serial-tracked lines."


async def test_create_purchase_serial_line_with_already_registered_imei_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()

    first = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_serial_line(product.id, imei=imei)],
        },
    )
    assert first.status_code == 201

    second = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [_serial_line(product.id, imei=imei)],
        },
    )

    assert second.status_code == 409
    assert second.json()["detail"] == f"IMEI {imei} already registered."


async def test_create_purchase_with_duplicate_imei_within_same_purchase_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    shared_imei = _unique_imei()

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={
            "supplier_id": str(supplier.id),
            "lines": [
                _serial_line(product.id, imei=shared_imei),
                _serial_line(product.id, imei=shared_imei),
            ],
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == (
        f"IMEI {shared_imei} is duplicated in this purchase."
    )


async def test_create_purchase_batch_line_with_imei_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.create")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    line = _batch_line(product.id)
    line["imei"] = _unique_imei()

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={"supplier_id": str(supplier.id), "lines": [line]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "imei is only valid for serial-tracked lines."


# --- 47-49: lectura ------------------------------------------------------------


async def test_get_purchase_by_id_returns_200(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "purchases.create", "purchases.read"
    )
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    create_response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={"supplier_id": str(supplier.id), "lines": [_batch_line(product.id)]},
    )
    purchase_id = create_response.json()["id"]

    response = await client.get(f"{_PURCHASES_URL}/{purchase_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == purchase_id


async def test_get_purchase_not_found_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.read")

    response = await client.get(f"{_PURCHASES_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Purchase not found."


async def test_get_purchases_filters_by_supplier_and_paginates(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "purchases.create", "purchases.read"
    )
    supplier_a = await create_supplier(db_session)
    supplier_b = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={"supplier_id": str(supplier_a.id), "lines": [_batch_line(product.id)]},
    )
    await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={"supplier_id": str(supplier_b.id), "lines": [_batch_line(product.id)]},
    )

    response = await client.get(
        _PURCHASES_URL,
        headers=headers,
        params={"supplier_id": str(supplier_a.id), "limit": 10, "offset": 0},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["supplier"]["id"] == str(supplier_a.id)


# --- 50: wiring sanity -------------------------------------------------------


async def test_create_purchase_without_permission_returns_403(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "purchases.read")
    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    response = await client.post(
        _PURCHASES_URL,
        headers=headers,
        json={"supplier_id": str(supplier.id), "lines": [_batch_line(product.id)]},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE


# --- 51: atomicidad, camino positivo, live_client, limpieza manual ------------


async def test_multi_line_purchase_persists_all_effects_together(live_client):
    """`PurchaseService._validate_lines` valida TODAS las lineas antes de
    escribir ninguna fila -- no existe un camino determinista donde una
    linea sobreviva parcialmente mientras otra falla despues, asi que
    aqui se prueba la atomicidad en su forma positiva: una compra real de
    2 lineas (1 serial + 1 batch), via `live_client` (sesion de
    produccion real, no la sesion compartida de `db_session`), debe
    persistir AMBOS efectos juntos en un solo commit real.
    """
    brand_id = None
    category_id = None
    serial_product_id = None
    batch_product_id = None
    supplier_id = None
    role_ids: list = []
    user_id = None
    purchase_id = None

    try:
        async with SessionFactory() as setup_session:
            serial_product = await create_product(
                setup_session, tracking_type=TrackingType.SERIAL
            )
            brand_id = serial_product.brand_id
            category_id = serial_product.category_id
            serial_product_id = serial_product.id

            batch_product = await create_product(
                setup_session,
                tracking_type=TrackingType.BATCH,
                brand_id=brand_id,
                category_id=category_id,
            )
            batch_product_id = batch_product.id

            supplier = await create_supplier(setup_session)
            supplier_id = supplier.id

            role = await create_role_with_permission(
                setup_session, "purchases.create"
            )
            role_ids = [role.id]

            user = await create_user(setup_session, role_ids=role_ids)
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(user_id))
        imei = _unique_imei()

        response = await live_client.post(
            _PURCHASES_URL,
            headers=headers,
            json={
                "supplier_id": str(supplier_id),
                "lines": [
                    _serial_line(serial_product_id, imei=imei),
                    _batch_line(batch_product_id, quantity=7, unit_cost="4.00"),
                ],
            },
        )
        assert response.status_code == 201
        purchase_id = UUID(response.json()["id"])

        async with SessionFactory() as verify_session:
            purchase = await verify_session.get(Purchase, purchase_id)
            assert purchase is not None

            unit_result = await verify_session.execute(
                select(ProductUnit).where(ProductUnit.imei == imei)
            )
            unit = unit_result.scalar_one_or_none()
            assert unit is not None, (
                "El efecto de la linea serial no persistio junto con la "
                "compra."
            )
            assert unit.status.value == "in_stock"

            lot_result = await verify_session.execute(
                select(StockLot).where(StockLot.product_id == batch_product_id)
            )
            lot = lot_result.scalar_one_or_none()
            assert lot is not None, (
                "El efecto de la linea batch no persistio junto con la "
                "compra."
            )
            assert lot.quantity_available == 7

    finally:
        async with SessionFactory() as cleanup_session:
            if serial_product_id is not None:
                await cleanup_session.execute(
                    delete(StockMovement).where(
                        StockMovement.product_id == serial_product_id
                    )
                )
                await cleanup_session.execute(
                    delete(ProductUnit).where(
                        ProductUnit.product_id == serial_product_id
                    )
                )

            if batch_product_id is not None:
                await cleanup_session.execute(
                    delete(StockMovement).where(
                        StockMovement.product_id == batch_product_id
                    )
                )
                await cleanup_session.execute(
                    delete(StockLot).where(
                        StockLot.product_id == batch_product_id
                    )
                )

            if purchase_id is not None:
                # purchase_line tiene ondelete="CASCADE" sobre purchase_id.
                await cleanup_session.execute(
                    delete(Purchase).where(Purchase.id == purchase_id)
                )

            for product_id in (serial_product_id, batch_product_id):
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

            if supplier_id is not None:
                await cleanup_session.execute(
                    delete(Supplier).where(Supplier.id == supplier_id)
                )

            if user_id is not None:
                await cleanup_session.execute(
                    delete(UserRole).where(UserRole.user_id == user_id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id == user_id)
                )

            if role_ids:
                await cleanup_session.execute(
                    delete(Role).where(Role.id.in_(role_ids))
                )

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            if purchase_id is not None:
                assert await check_session.get(Purchase, purchase_id) is None

            for product_id in (serial_product_id, batch_product_id):
                if product_id is not None:
                    assert await check_session.get(Product, product_id) is None

            if supplier_id is not None:
                assert await check_session.get(Supplier, supplier_id) is None

            if user_id is not None:
                assert await check_session.get(User, user_id) is None

            for role_id in role_ids:
                assert await check_session.get(Role, role_id) is None
