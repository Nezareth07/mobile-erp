"""Tests de integracion HTTP para /sales (Etapa 6b).

Mismo patron de permisos que el resto de Etapa 6: un usuario con
exactamente los permisos necesarios via create_role_with_permission
(Etapa 4), sin tocar factories.py.

22 de los 24 casos usan `client`/`db_session`. Los 2 restantes usan
`live_client` con limpieza manual, por las mismas razones ya establecidas
en Inventory (#34) y Purchase (#51):

- #74 (FIFO real): `StockLot.received_at` es `server_default=now()`,
  estable durante toda una transaccion Postgres -- se necesitan dos
  intakes en transacciones realmente separadas para que el segundo lote
  reciba un `received_at` genuinamente posterior, sin sleep().
- #75 (atomicidad, camino positivo): igual razonamiento que Purchase
  #51 -- `SaleService._validate_lines` valida TODAS las lineas (incluida
  la suma de cantidades batch contra el stock disponible) antes de
  escribir ninguna fila, asi que no hay un camino determinista y no
  concurrente donde una linea sobreviva parcialmente mientras otra falla
  despues. Se prueba atomicidad en su forma positiva: una venta real de
  2 lineas persiste todos sus efectos juntos, via una sesion de
  produccion genuina.

Sin mocks, sin sleep().
"""
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import delete, select

from app.core.database.session import SessionFactory
from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.models.user_role import UserRole
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.customer.models.customer import Customer
from app.modules.customer.services.customer_service import CustomerService
from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.models.product_unit import ProductUnit
from app.modules.inventory.models.stock_lot import StockLot
from app.modules.inventory.models.stock_movement import StockMovement
from app.modules.inventory.schemas.batch_intake_create import BatchIntakeCreate
from app.modules.inventory.schemas.serial_intake_create import SerialIntakeCreate
from app.modules.inventory.services.inventory_service import InventoryService
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.brand import Brand
from app.modules.product.models.category import Category
from app.modules.product.models.product import Product
from app.modules.product.services.product_service import ProductService
from app.modules.sale.models.sale import Sale
from app.modules.sale.models.sale_line import SaleLine
from factories import (
    create_customer,
    create_product,
    create_role_with_permission,
    create_user,
)

_SALES_URL = "/api/v1/sales"

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


def _batch_line(product_id, quantity=1, unit_price=None) -> dict:
    line = {"product_id": str(product_id), "quantity": quantity}
    if unit_price is not None:
        line["unit_price"] = unit_price
    return line


def _serial_line(product_id, imei) -> dict:
    return {"product_id": str(product_id), "quantity": 1, "imei": imei}


async def _intake_serial(db_session, product, imei):
    await InventoryService(db_session).register_serial_intake(
        SerialIntakeCreate(
            product_id=product.id,
            imei=imei,
            unit_cost="80.00",
            source_type=MovementSourceType.MANUAL,
        )
    )


async def _intake_batch(db_session, product, quantity, unit_cost="5.00"):
    await InventoryService(db_session).register_batch_intake(
        BatchIntakeCreate(
            product_id=product.id,
            quantity=quantity,
            unit_cost=unit_cost,
            source_type=MovementSourceType.MANUAL,
        )
    )


# --- 52-53: creacion exitosa -------------------------------------------------


async def test_create_sale_success_explicit_customer_batch_line(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price="25.00"
    )
    await _intake_batch(db_session, product, quantity=10, unit_cost="10.00")

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=4)],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["total_amount"] == "100.00"
    assert body["total_cost"] == "40.00"
    assert body["profit"] == "60.00"


async def test_create_sale_success_serial_line_marks_unit_sold(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()
    await _intake_serial(db_session, product, imei)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_serial_line(product.id, imei)],
        },
    )

    assert response.status_code == 201
    assert response.json()["lines"][0]["imei"] == imei

    unit = await InventoryService(db_session).get_unit_by_imei(imei)
    assert unit.status.value == "sold"


# --- 54-55: cliente por defecto ------------------------------------------------


async def test_create_sale_without_customer_id_uses_default_customer(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    default_customer = await create_customer(db_session)
    await CustomerService(db_session).set_default_customer(default_customer.id)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={"lines": [_batch_line(product.id, quantity=1)]},
    )

    assert response.status_code == 201
    assert response.json()["customer"]["id"] == str(default_customer.id)


async def test_create_sale_without_customer_id_and_no_default_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={"lines": [_batch_line(product.id, quantity=1)]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "No customer_id was provided and no default customer is "
        "configured."
    )


# --- 56-57: validacion de cliente ----------------------------------------------


async def test_create_sale_with_nonexistent_customer_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(uuid4()),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found."


async def test_create_sale_with_inactive_customer_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    await CustomerService(db_session).delete_customer(customer.id)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Customer is not active."


# --- 58-59: validacion de producto ---------------------------------------------


async def test_create_sale_with_nonexistent_product_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    missing_product_id = uuid4()

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(missing_product_id, quantity=1)],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == f"Product {missing_product_id} not found."


async def test_create_sale_with_inactive_product_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)
    await ProductService(db_session).delete_product(product.id)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == f"Product {product.id} is not active."


# --- 60-66: validacion de lineas serial/batch ----------------------------------


async def test_create_sale_serial_line_with_quantity_other_than_one_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()
    await _intake_serial(db_session, product, imei)

    line = _serial_line(product.id, imei)
    line["quantity"] = 2

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={"customer_id": str(customer.id), "lines": [line]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Serial-tracked lines must have quantity=1."


async def test_create_sale_serial_line_without_imei_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [{"product_id": str(product.id), "quantity": 1}],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "imei is required for serial-tracked lines."


async def test_create_sale_serial_line_with_unknown_imei_returns_404(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_serial_line(product.id, _unique_imei())],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Product unit not found."


async def test_create_sale_serial_line_imei_belongs_to_another_product_returns_404(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product_a = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    product_b = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()
    await _intake_serial(db_session, product_a, imei)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_serial_line(product_b.id, imei)],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == (
        f"IMEI {imei} does not belong to product {product_b.id}."
    )


async def test_create_sale_serial_line_with_already_sold_imei_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()
    await _intake_serial(db_session, product, imei)

    first = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_serial_line(product.id, imei)],
        },
    )
    assert first.status_code == 201

    second = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_serial_line(product.id, imei)],
        },
    )

    assert second.status_code == 409
    assert second.json()["detail"] == f"IMEI {imei} already sold."


async def test_create_sale_with_duplicate_imei_within_same_sale_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)
    imei = _unique_imei()
    await _intake_serial(db_session, product, imei)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [
                _serial_line(product.id, imei),
                _serial_line(product.id, imei),
            ],
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == f"IMEI {imei} is duplicated in this sale."


async def test_create_sale_batch_line_with_imei_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    line = _batch_line(product.id, quantity=1)
    line["imei"] = _unique_imei()

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={"customer_id": str(customer.id), "lines": [line]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "imei is only valid for serial-tracked lines."


# --- 67: stock insuficiente -----------------------------------------------------


async def test_create_sale_batch_line_with_insufficient_stock_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=2)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=5)],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == f"Insufficient stock for product {product.id}."


# --- 68-69: unit_price por defecto vs explicito ---------------------------------


async def test_create_sale_batch_line_without_unit_price_uses_product_sale_price(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price="30.00"
    )
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=2)],
        },
    )

    assert response.status_code == 201
    assert response.json()["lines"][0]["unit_price"] == "30.00"


async def test_create_sale_batch_line_with_explicit_unit_price_overrides_default(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "sales.create")
    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price="30.00"
    )
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=2, unit_price="18.50")],
        },
    )

    assert response.status_code == 201
    assert response.json()["lines"][0]["unit_price"] == "18.50"


# --- 70-72: lectura --------------------------------------------------------------


async def test_get_sale_by_id_returns_200(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "sales.create", "sales.read"
    )
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    create_response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )
    sale_id = create_response.json()["id"]

    response = await client.get(f"{_SALES_URL}/{sale_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == sale_id


async def test_get_sale_not_found_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.read")

    response = await client.get(f"{_SALES_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Sale not found."


async def test_get_sales_filters_by_customer_and_paginates(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "sales.create", "sales.read"
    )
    customer_a = await create_customer(db_session)
    customer_b = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=10)

    await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer_a.id),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )
    await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer_b.id),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )

    response = await client.get(
        _SALES_URL,
        headers=headers,
        params={"customer_id": str(customer_a.id), "limit": 10, "offset": 0},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["customer"]["id"] == str(customer_a.id)


# --- 73: wiring sanity -------------------------------------------------------


async def test_create_sale_without_permission_returns_403(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "sales.read")
    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _intake_batch(db_session, product, quantity=5)

    response = await client.post(
        _SALES_URL,
        headers=headers,
        json={
            "customer_id": str(customer.id),
            "lines": [_batch_line(product.id, quantity=1)],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE


# --- 74: FIFO real, live_client, limpieza manual --------------------------------


async def test_batch_sale_consumes_earliest_lot_first_with_weighted_average_cost(
    live_client,
):
    """Dos intakes en transacciones separadas (`SessionFactory` distinto
    por bloque) para que el segundo lote reciba un `received_at`
    genuinamente posterior sin sleep(). La venta real pasa por
    `live_client`. `register_batch_sale` SI reparte el consumo entre
    varios lotes (a diferencia de `_adjust_lot_quantity`, que solo toca
    uno) -- por eso esta venta pide una cantidad que abarca ambos lotes.
    """
    brand_id = None
    category_id = None
    product_id = None
    customer_id = None
    role_ids: list = []
    user_id = None
    sale_id = None
    lot_a_id = None
    lot_b_id = None

    try:
        async with SessionFactory() as setup_session:
            product = await create_product(
                setup_session, tracking_type=TrackingType.BATCH
            )
            product_id = product.id
            brand_id = product.brand_id
            category_id = product.category_id

            lot_a = await InventoryService(setup_session).register_batch_intake(
                BatchIntakeCreate(
                    product_id=product_id,
                    quantity=5,
                    unit_cost="10.00",
                    source_type=MovementSourceType.MANUAL,
                )
            )
            lot_a_id = lot_a.id
            await setup_session.commit()

        async with SessionFactory() as setup_session_2:
            lot_b = await InventoryService(setup_session_2).register_batch_intake(
                BatchIntakeCreate(
                    product_id=product_id,
                    quantity=5,
                    unit_cost="20.00",
                    source_type=MovementSourceType.MANUAL,
                )
            )
            lot_b_id = lot_b.id
            await setup_session_2.commit()

        async with SessionFactory() as setup_session_3:
            customer = await create_customer(setup_session_3)
            customer_id = customer.id

            role = await create_role_with_permission(
                setup_session_3, "sales.create"
            )
            role_ids = [role.id]

            user = await create_user(setup_session_3, role_ids=role_ids)
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(user_id))

        response = await live_client.post(
            _SALES_URL,
            headers=headers,
            json={
                "customer_id": str(customer_id),
                "lines": [_batch_line(product_id, quantity=6)],
            },
        )
        assert response.status_code == 201
        body = response.json()
        sale_id = UUID(body["id"])

        # 5 unidades del lote A (costo 10) + 1 unidad del lote B (costo 20)
        # = 70 / 6 -- Decimal puro, sin quantize(), con la precision por
        # defecto del contexto decimal de Python (28 cifras significativas).
        # HALLAZGO: como SessionFactory usa expire_on_commit=False (igual
        # en produccion), `get_sale()` reutiliza el objeto ya en el mapa de
        # identidad de la sesion en vez de releer la fila recien insertada
        # -- la respuesta HTTP expone este valor SIN redondear, mientras
        # que la columna real en Postgres es Numeric(12,2) y SI redondea a
        # 2 decimales al guardar. Documentado como hallazgo, no corregido
        # (no se modifica backend/app/ en esta etapa).
        expected_unit_cost_in_response = str(Decimal("70.00") / 6)
        assert body["lines"][0]["unit_cost"] == expected_unit_cost_in_response

        async with SessionFactory() as verify_session:
            lot_a_refreshed = await verify_session.get(StockLot, lot_a_id)
            lot_b_refreshed = await verify_session.get(StockLot, lot_b_id)

            assert lot_a_refreshed.quantity_available == 0, (
                "El lote mas antiguo (A) debio agotarse primero"
            )
            assert lot_b_refreshed.quantity_available == 4, (
                "Solo 1 unidad debio tomarse del lote mas nuevo (B), "
                f"obtuve consumo de {5 - lot_b_refreshed.quantity_available}"
            )

            sale_line_result = await verify_session.execute(
                select(SaleLine).where(SaleLine.sale_id == sale_id)
            )
            persisted_line = sale_line_result.scalar_one()
            assert persisted_line.unit_cost == Decimal("11.67"), (
                "La columna Numeric(12,2) real en Postgres SI redondea -- "
                "confirma que la divergencia esta solo en la respuesta "
                "HTTP (objeto no refrescado), no en el dato almacenado."
            )

    finally:
        async with SessionFactory() as cleanup_session:
            if sale_id is not None:
                # sale_line tiene ondelete="CASCADE" sobre sale_id.
                await cleanup_session.execute(
                    delete(Sale).where(Sale.id == sale_id)
                )

            if product_id is not None:
                await cleanup_session.execute(
                    delete(StockMovement).where(
                        StockMovement.product_id == product_id
                    )
                )
                await cleanup_session.execute(
                    delete(StockLot).where(StockLot.product_id == product_id)
                )
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

            if role_ids:
                await cleanup_session.execute(
                    delete(Role).where(Role.id.in_(role_ids))
                )

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            if sale_id is not None:
                assert await check_session.get(Sale, sale_id) is None
            if product_id is not None:
                assert await check_session.get(Product, product_id) is None
            if customer_id is not None:
                assert await check_session.get(Customer, customer_id) is None
            if user_id is not None:
                assert await check_session.get(User, user_id) is None
            for role_id in role_ids:
                assert await check_session.get(Role, role_id) is None


# --- 75: atomicidad, camino positivo, live_client, limpieza manual --------------


async def test_multi_line_sale_persists_all_effects_together(live_client):
    """Igual razonamiento que Purchase #51: `SaleService._validate_lines`
    valida TODAS las lineas (incluida la suma de cantidades batch contra
    stock disponible) antes de escribir ninguna fila -- no hay un camino
    determinista donde una linea sobreviva parcialmente mientras otra
    falla despues. Se prueba la forma positiva: una venta real de 2
    lineas (1 serial + 1 batch) persiste ambos efectos juntos en un solo
    commit real via `live_client`.
    """
    brand_id = None
    category_id = None
    serial_product_id = None
    batch_product_id = None
    customer_id = None
    role_ids: list = []
    user_id = None
    sale_id = None
    imei = None

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

            imei = _unique_imei()
            await InventoryService(setup_session).register_serial_intake(
                SerialIntakeCreate(
                    product_id=serial_product_id,
                    imei=imei,
                    unit_cost="80.00",
                    source_type=MovementSourceType.MANUAL,
                )
            )
            await InventoryService(setup_session).register_batch_intake(
                BatchIntakeCreate(
                    product_id=batch_product_id,
                    quantity=5,
                    unit_cost="4.00",
                    source_type=MovementSourceType.MANUAL,
                )
            )

            customer = await create_customer(setup_session)
            customer_id = customer.id

            role = await create_role_with_permission(setup_session, "sales.create")
            role_ids = [role.id]

            user = await create_user(setup_session, role_ids=role_ids)
            user_id = user.id

        headers = _bearer(JWTHandler.create_access_token(user_id))

        response = await live_client.post(
            _SALES_URL,
            headers=headers,
            json={
                "customer_id": str(customer_id),
                "lines": [
                    _serial_line(serial_product_id, imei),
                    _batch_line(batch_product_id, quantity=3),
                ],
            },
        )
        assert response.status_code == 201
        sale_id = UUID(response.json()["id"])

        async with SessionFactory() as verify_session:
            sale = await verify_session.get(Sale, sale_id)
            assert sale is not None

            unit_result = await verify_session.execute(
                select(ProductUnit).where(ProductUnit.imei == imei)
            )
            unit = unit_result.scalar_one_or_none()
            assert unit is not None
            assert unit.status.value == "sold", (
                "El efecto de la linea serial no persistio junto con la "
                "venta."
            )

            lot_result = await verify_session.execute(
                select(StockLot).where(StockLot.product_id == batch_product_id)
            )
            lot = lot_result.scalar_one_or_none()
            assert lot is not None
            assert lot.quantity_available == 2, (
                "El efecto de la linea batch no persistio junto con la "
                "venta."
            )

    finally:
        async with SessionFactory() as cleanup_session:
            for product_id in (serial_product_id, batch_product_id):
                if product_id is not None:
                    await cleanup_session.execute(
                        delete(StockMovement).where(
                            StockMovement.product_id == product_id
                        )
                    )

            if serial_product_id is not None:
                # product_unit.sale_line_id no tiene ondelete="CASCADE" --
                # debe borrarse ANTES que Sale (que sí cascadea a
                # sale_line), o la FK lo bloquea.
                await cleanup_session.execute(
                    delete(ProductUnit).where(
                        ProductUnit.product_id == serial_product_id
                    )
                )

            if sale_id is not None:
                await cleanup_session.execute(
                    delete(Sale).where(Sale.id == sale_id)
                )

            if batch_product_id is not None:
                await cleanup_session.execute(
                    delete(StockLot).where(
                        StockLot.product_id == batch_product_id
                    )
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

            if role_ids:
                await cleanup_session.execute(
                    delete(Role).where(Role.id.in_(role_ids))
                )

            await cleanup_session.commit()

        async with SessionFactory() as check_session:
            if sale_id is not None:
                assert await check_session.get(Sale, sale_id) is None
            for product_id in (serial_product_id, batch_product_id):
                if product_id is not None:
                    assert await check_session.get(Product, product_id) is None
            if customer_id is not None:
                assert await check_session.get(Customer, customer_id) is None
            if user_id is not None:
                assert await check_session.get(User, user_id) is None
            for role_id in role_ids:
                assert await check_session.get(Role, role_id) is None
