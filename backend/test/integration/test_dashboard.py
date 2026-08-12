"""Tests de integracion HTTP para /dashboard (Fase 7).

Mismo patron de permisos que el resto de la suite: un usuario con
exactamente los permisos necesarios via create_role_with_permission, sin
tocar factories.py. Las ventas/compras de fixture se crean llamando
directamente a SaleService/PurchaseService/InventoryService (nunca
insertando filas a mano) -- son datos de configuracion, no lo que se
prueba, igual que `_intake_serial`/`_intake_batch` en test_sales.py.

Los campos monetarios se comparan con Decimal(...) en vez de strings
literales: a diferencia de columnas Numeric(12,2) normales (donde Postgres
siempre imprime 2 decimales), estos endpoints devuelven
SUM(...)/COALESCE(..., 0) agregados, cuyo formato de cero puede no traer
el mismo padding -- comparar por valor evita acoplarse a eso sin perder
precision.

Sin mocks, sin sleep(), sin tests de concurrencia (todo el modulo es de
solo lectura).
"""
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select

from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.inventory.enums.movement_source_type import MovementSourceType
from app.modules.inventory.models.location import Location
from app.modules.inventory.schemas.batch_intake_create import BatchIntakeCreate
from app.modules.inventory.services.inventory_service import InventoryService
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.purchase.schemas.purchase_create import PurchaseCreate
from app.modules.purchase.schemas.purchase_line_create import PurchaseLineCreate
from app.modules.purchase.services.purchase_service import PurchaseService
from app.modules.sale.schemas.sale_create import SaleCreate
from app.modules.sale.schemas.sale_line_create import SaleLineCreate
from app.modules.sale.services.sale_service import SaleService
from factories import (
    create_customer,
    create_product,
    create_role_with_permission,
    create_supplier,
    create_user,
)

_URL = "/api/v1/dashboard"

_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."

_LIST_ENDPOINTS = ("/sales-overview", "/top-products", "/top-customers", "/recent-activity")
_ALL_ENDPOINTS = ("/summary",) + _LIST_ENDPOINTS


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


async def _get_seeded_location_id(db_session):
    result = await db_session.execute(select(Location))
    return result.scalars().one().id


async def _intake_and_sell(
    db_session,
    customer,
    product,
    quantity,
    unit_price,
    sale_date,
    location_id=None,
    unit_cost=Decimal("5.00"),
):
    await InventoryService(db_session).register_batch_intake(
        BatchIntakeCreate(
            product_id=product.id,
            quantity=quantity,
            unit_cost=unit_cost,
            location_id=location_id,
            source_type=MovementSourceType.MANUAL,
        )
    )
    return await SaleService(db_session).create_sale(
        SaleCreate(
            customer_id=customer.id,
            location_id=location_id,
            sale_date=sale_date,
            lines=[
                SaleLineCreate(
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,
                )
            ],
        )
    )


async def _make_purchase(
    db_session,
    supplier,
    product,
    quantity,
    unit_cost,
    purchase_date,
    location_id=None,
):
    return await PurchaseService(db_session).create_purchase(
        PurchaseCreate(
            supplier_id=supplier.id,
            location_id=location_id,
            purchase_date=purchase_date,
            lines=[
                PurchaseLineCreate(
                    product_id=product.id,
                    quantity=quantity,
                    unit_cost=unit_cost,
                )
            ],
        )
    )


# --- autorizacion ----------------------------------------------------------


async def test_dashboard_endpoints_without_permission_return_403(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session)

    for path in _ALL_ENDPOINTS:
        response = await client.get(f"{_URL}{path}", headers=headers)
        assert response.status_code == 403, path
        assert response.json()["detail"] == _FORBIDDEN_MESSAGE


async def test_dashboard_endpoints_with_permission_return_200(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    for path in _ALL_ENDPOINTS:
        response = await client.get(f"{_URL}{path}", headers=headers)
        assert response.status_code == 200, path


# --- sin datos ---------------------------------------------------------


async def test_dashboard_summary_with_no_data_returns_zeros(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    response = await client.get(f"{_URL}/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()

    assert body["sales_today"]["sales_count"] == 0
    assert Decimal(body["sales_today"]["total_amount"]) == Decimal("0")
    assert body["sales_period"]["sales_count"] == 0
    assert body["purchases_period"]["purchases_count"] == 0
    assert Decimal(body["purchases_period"]["total_cost"]) == Decimal("0")
    assert body["active_customers_count"] == 0
    assert body["active_products_count"] == 0
    assert body["active_suppliers_count"] == 0


async def test_dashboard_lists_with_no_data_return_empty_lists(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    for path in _LIST_ENDPOINTS:
        response = await client.get(f"{_URL}{path}", headers=headers)
        assert response.status_code == 200, path
        assert response.json() == []


# --- summary con datos conocidos -------------------------------------------


async def test_dashboard_summary_with_known_sales_and_purchases(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer = await create_customer(db_session)
    supplier = await create_supplier(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("25.00")
    )

    now = datetime.now(timezone.utc)

    await _intake_and_sell(
        db_session, customer, product, quantity=4, unit_price=Decimal("25.00"),
        sale_date=now, unit_cost=Decimal("10.00"),
    )
    await _intake_and_sell(
        db_session, customer, product, quantity=2, unit_price=Decimal("25.00"),
        sale_date=now, unit_cost=Decimal("10.00"),
    )
    await _make_purchase(
        db_session, supplier, product, quantity=10, unit_cost=Decimal("8.00"),
        purchase_date=now,
    )

    response = await client.get(f"{_URL}/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()

    sales_today = body["sales_today"]
    assert sales_today["sales_count"] == 2
    assert Decimal(sales_today["total_amount"]) == Decimal("150.00")
    assert Decimal(sales_today["total_cost"]) == Decimal("60.00")
    assert Decimal(sales_today["total_profit"]) == Decimal("90.00")

    # sin date_from/date_to, sales_period cubre la misma ventana de "hoy"
    assert body["sales_period"] == sales_today

    purchases_period = body["purchases_period"]
    assert purchases_period["purchases_count"] == 1
    assert Decimal(purchases_period["total_cost"]) == Decimal("80.00")

    assert body["active_customers_count"] == 1
    assert body["active_products_count"] == 1
    assert body["active_suppliers_count"] == 1


# --- valores monetarios exactos ---------------------------------------------


async def test_dashboard_monetary_fields_serialize_as_exact_decimal_strings(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("19.99")
    )
    await _intake_and_sell(
        db_session, customer, product, quantity=3, unit_price=Decimal("19.99"),
        sale_date=datetime.now(timezone.utc), unit_cost=Decimal("7.33"),
    )

    response = await client.get(f"{_URL}/summary", headers=headers)
    body = response.json()

    total_amount_raw = body["sales_period"]["total_amount"]
    total_cost_raw = body["sales_period"]["total_cost"]

    assert isinstance(total_amount_raw, str)
    assert isinstance(total_cost_raw, str)
    assert Decimal(total_amount_raw) == Decimal("59.97")
    assert Decimal(total_cost_raw) == Decimal("21.99")


# --- sales-overview: agregacion diaria y bordes de fecha --------------------


async def test_dashboard_sales_overview_daily_aggregation_and_date_boundary(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("10.00")
    )

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    yesterday_start = datetime.combine(yesterday, time.min, tzinfo=timezone.utc)
    today_start = datetime.combine(today, time.min, tzinfo=timezone.utc)
    tomorrow_start = today_start + timedelta(days=1)

    await _intake_and_sell(
        db_session, customer, product, quantity=3, unit_price=Decimal("10.00"),
        sale_date=yesterday_start,
    )
    await _intake_and_sell(
        db_session, customer, product, quantity=1, unit_price=Decimal("10.00"),
        sale_date=today_start,
    )
    # Exactamente en el limite exclusivo de date_to -- no debe incluirse.
    await _intake_and_sell(
        db_session, customer, product, quantity=99, unit_price=Decimal("10.00"),
        sale_date=tomorrow_start,
    )

    response = await client.get(
        f"{_URL}/sales-overview",
        headers=headers,
        params={
            "date_from": yesterday.isoformat(),
            "date_to": tomorrow_start.date().isoformat(),
        },
    )

    assert response.status_code == 200
    points = response.json()
    assert len(points) == 2

    assert points[0]["date"] == yesterday.isoformat()
    assert points[0]["sales_count"] == 1
    assert Decimal(points[0]["revenue"]) == Decimal("30.00")

    assert points[1]["date"] == today.isoformat()
    assert points[1]["sales_count"] == 1
    assert Decimal(points[1]["revenue"]) == Decimal("10.00")


async def test_dashboard_summary_period_date_filters_are_respected(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("50.00")
    )

    today = datetime.now(timezone.utc).date()
    last_week = today - timedelta(days=7)

    await _intake_and_sell(
        db_session, customer, product, quantity=1, unit_price=Decimal("50.00"),
        sale_date=datetime.combine(last_week, time.min, tzinfo=timezone.utc),
    )

    including = await client.get(
        f"{_URL}/summary",
        headers=headers,
        params={
            "date_from": last_week.isoformat(),
            "date_to": (today + timedelta(days=1)).isoformat(),
        },
    )
    excluding = await client.get(
        f"{_URL}/summary",
        headers=headers,
        params={
            "date_from": today.isoformat(),
            "date_to": (today + timedelta(days=1)).isoformat(),
        },
    )

    assert Decimal(including.json()["sales_period"]["total_amount"]) == Decimal("50.00")
    assert Decimal(excluding.json()["sales_period"]["total_amount"]) == Decimal("0")


async def test_dashboard_date_from_not_before_date_to_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    today = datetime.now(timezone.utc).date()

    response = await client.get(
        f"{_URL}/summary",
        headers=headers,
        params={"date_from": today.isoformat(), "date_to": today.isoformat()},
    )

    assert response.status_code == 400


async def test_dashboard_date_from_after_date_to_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    response = await client.get(
        f"{_URL}/summary",
        headers=headers,
        params={"date_from": today.isoformat(), "date_to": yesterday.isoformat()},
    )

    assert response.status_code == 400


# --- filtro por location_id -------------------------------------------------


async def test_dashboard_location_filter(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("15.00")
    )
    await _intake_and_sell(
        db_session, customer, product, quantity=2, unit_price=Decimal("15.00"),
        sale_date=datetime.now(timezone.utc),
    )

    seeded_location_id = await _get_seeded_location_id(db_session)

    matching = await client.get(
        f"{_URL}/summary",
        headers=headers,
        params={"location_id": str(seeded_location_id)},
    )
    assert matching.status_code == 200
    assert Decimal(matching.json()["sales_period"]["total_amount"]) == Decimal("30.00")

    unknown_location = await client.get(
        f"{_URL}/summary",
        headers=headers,
        params={"location_id": str(uuid4())},
    )
    assert unknown_location.status_code == 404


# --- top-products ------------------------------------------------------------


async def test_dashboard_top_products_ordering(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer = await create_customer(db_session)
    product_a = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("10.00")
    )
    product_b = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("100.00")
    )

    now = datetime.now(timezone.utc)
    await _intake_and_sell(
        db_session, customer, product_a, quantity=5, unit_price=Decimal("10.00"),
        sale_date=now,
    )
    await _intake_and_sell(
        db_session, customer, product_b, quantity=2, unit_price=Decimal("100.00"),
        sale_date=now,
    )

    by_revenue = await client.get(f"{_URL}/top-products", headers=headers)
    items = by_revenue.json()
    assert items[0]["product"]["id"] == str(product_b.id)
    assert Decimal(items[0]["revenue"]) == Decimal("200.00")
    assert items[0]["quantity_sold"] == 2

    by_quantity = await client.get(
        f"{_URL}/top-products", headers=headers, params={"order_by": "quantity"}
    )
    items_q = by_quantity.json()
    assert items_q[0]["product"]["id"] == str(product_a.id)
    assert items_q[0]["quantity_sold"] == 5


async def test_dashboard_top_products_limit_and_invalid_order_by(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    invalid = await client.get(
        f"{_URL}/top-products", headers=headers, params={"order_by": "bogus"}
    )
    assert invalid.status_code == 422

    too_high_limit = await client.get(
        f"{_URL}/top-products", headers=headers, params={"limit": 999}
    )
    assert too_high_limit.status_code == 422


# --- top-customers -----------------------------------------------------------


async def test_dashboard_top_customers_ordering(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    customer_a = await create_customer(db_session)
    customer_b = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("20.00")
    )

    now = datetime.now(timezone.utc)
    await _intake_and_sell(
        db_session, customer_a, product, quantity=1, unit_price=Decimal("20.00"),
        sale_date=now,
    )
    await _intake_and_sell(
        db_session, customer_b, product, quantity=3, unit_price=Decimal("20.00"),
        sale_date=now,
    )

    response = await client.get(f"{_URL}/top-customers", headers=headers)

    assert response.status_code == 200
    items = response.json()
    assert items[0]["customer"]["id"] == str(customer_b.id)
    assert Decimal(items[0]["revenue"]) == Decimal("60.00")
    assert items[0]["sales_count"] == 1
    assert items[1]["customer"]["id"] == str(customer_a.id)


# --- recent-activity -----------------------------------------------------


async def test_dashboard_recent_activity(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    supplier = await create_supplier(db_session)
    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("12.00")
    )

    now = datetime.now(timezone.utc)
    await _make_purchase(
        db_session, supplier, product, quantity=5, unit_cost=Decimal("4.00"),
        purchase_date=now,
    )
    await SaleService(db_session).create_sale(
        SaleCreate(
            customer_id=customer.id,
            sale_date=now,
            lines=[
                SaleLineCreate(
                    product_id=product.id, quantity=2, unit_price=Decimal("12.00")
                )
            ],
        )
    )

    response = await client.get(
        f"{_URL}/recent-activity", headers=headers, params={"limit": 10}
    )

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2

    movement_types = {item["movement_type"] for item in items}
    assert movement_types == {"purchase_in", "sale_out"}
    assert items[0]["created_at"] >= items[1]["created_at"]

    for item in items:
        assert item["product"]["id"] == str(product.id)
        assert item["location"]["id"]


async def test_dashboard_recent_activity_respects_limit(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    for _ in range(3):
        await _make_purchase(
            db_session, supplier, product, quantity=1, unit_cost=Decimal("1.00"),
            purchase_date=datetime.now(timezone.utc),
        )

    response = await client.get(
        f"{_URL}/recent-activity", headers=headers, params={"limit": 2}
    )

    assert response.status_code == 200
    assert len(response.json()) == 2


# --- regresion de endpoints existentes ---------------------------------


async def test_existing_sales_and_purchases_endpoints_still_work(client, db_session):
    _, sales_headers = await _issue_user_with_permissions(db_session, "sales.read")
    _, purchases_headers = await _issue_user_with_permissions(
        db_session, "purchases.read"
    )

    sales_response = await client.get("/api/v1/sales", headers=sales_headers)
    purchases_response = await client.get(
        "/api/v1/purchases", headers=purchases_headers
    )

    assert sales_response.status_code == 200
    assert purchases_response.status_code == 200


async def test_existing_inventory_stock_endpoint_still_works(client, db_session):
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    _, headers = await _issue_user_with_permissions(db_session, "inventory.read")

    response = await client.get(
        f"/api/v1/inventory/products/{product.id}/stock", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["available_quantity"] == 0
