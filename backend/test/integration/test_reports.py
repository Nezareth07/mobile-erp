"""Tests de integracion HTTP para /reports (Fase 8).

Mismo patron de permisos que el resto de la suite: un usuario con
exactamente los permisos necesarios via create_role_with_permission, sin
tocar factories.py. Las ventas/compras/movimientos de fixture se crean
llamando directamente a SaleService/PurchaseService/InventoryService
(nunca insertando filas a mano) -- igual que test_dashboard.py.

Los campos monetarios se comparan con Decimal(...) en vez de strings
literales por la misma razon que en test_dashboard.py: son agregados
SUM(...)/COALESCE(..., 0), no columnas Numeric(12,2) simples.

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
from app.modules.inventory.schemas.serial_intake_create import SerialIntakeCreate
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

_URL = "/api/v1/reports"

_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."

_ALL_ENDPOINTS = (
    "/sales/summary",
    "/sales/timeseries",
    "/sales/top-products",
    "/sales/top-customers",
    "/purchases/summary",
    "/purchases/timeseries",
    "/purchases/top-suppliers",
    "/purchases/top-products",
    "/inventory/valuation",
    "/inventory/movements",
)
_LIST_ENDPOINTS = (
    "/sales/timeseries",
    "/sales/top-products",
    "/sales/top-customers",
    "/purchases/timeseries",
    "/purchases/top-suppliers",
    "/purchases/top-products",
    "/inventory/valuation",
    "/inventory/movements",
)
_DATE_VALIDATED_ENDPOINTS = tuple(
    path for path in _ALL_ENDPOINTS if path != "/inventory/valuation"
)


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


def _unique_imei() -> str:
    return str(uuid4().int)[:15]


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


async def _intake_serial(db_session, product, imei, unit_cost=Decimal("80.00")):
    return await InventoryService(db_session).register_serial_intake(
        SerialIntakeCreate(
            product_id=product.id,
            imei=imei,
            unit_cost=unit_cost,
            source_type=MovementSourceType.MANUAL,
        )
    )


async def _sell_serial(db_session, customer, product, imei, unit_price, sale_date):
    return await SaleService(db_session).create_sale(
        SaleCreate(
            customer_id=customer.id,
            sale_date=sale_date,
            lines=[
                SaleLineCreate(
                    product_id=product.id,
                    quantity=1,
                    unit_price=unit_price,
                    imei=imei,
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


async def test_reports_endpoints_without_permission_return_403(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session)

    for path in _ALL_ENDPOINTS:
        response = await client.get(f"{_URL}{path}", headers=headers)
        assert response.status_code == 403, path
        assert response.json()["detail"] == _FORBIDDEN_MESSAGE


async def test_reports_endpoints_with_permission_return_200(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    for path in _ALL_ENDPOINTS:
        response = await client.get(f"{_URL}{path}", headers=headers)
        assert response.status_code == 200, path


# --- sin datos ---------------------------------------------------------


async def test_reports_summaries_with_no_data_return_zeros(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    sales_summary = await client.get(f"{_URL}/sales/summary", headers=headers)
    purchases_summary = await client.get(
        f"{_URL}/purchases/summary", headers=headers
    )

    assert sales_summary.status_code == 200
    body = sales_summary.json()
    assert body["sales_count"] == 0
    assert Decimal(body["total_amount"]) == Decimal("0")
    assert body["profit_margin"] is None

    assert purchases_summary.status_code == 200
    purchases_body = purchases_summary.json()
    assert purchases_body["purchases_count"] == 0
    assert Decimal(purchases_body["total_cost"]) == Decimal("0")


async def test_reports_lists_with_no_data_return_empty_lists(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    for path in _LIST_ENDPOINTS:
        response = await client.get(f"{_URL}{path}", headers=headers)
        assert response.status_code == 200, path
        assert response.json() == []


# --- sales/summary: agregacion conocida + profit_margin --------------------


async def test_reports_sales_summary_known_values_and_margin(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("25.00")
    )

    now = datetime.now(timezone.utc)
    await _intake_and_sell(
        db_session, customer, product, quantity=3, unit_price=Decimal("25.00"),
        sale_date=now, unit_cost=Decimal("10.00"),
    )

    response = await client.get(f"{_URL}/sales/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["sales_count"] == 1
    assert Decimal(body["total_amount"]) == Decimal("75.00")
    assert Decimal(body["total_cost"]) == Decimal("30.00")
    assert Decimal(body["total_profit"]) == Decimal("45.00")
    assert Decimal(body["profit_margin"]) == Decimal("60.00")


async def test_reports_purchases_summary_known_values(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    await _make_purchase(
        db_session, supplier, product, quantity=5, unit_cost=Decimal("8.00"),
        purchase_date=datetime.now(timezone.utc),
    )

    response = await client.get(f"{_URL}/purchases/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["purchases_count"] == 1
    assert Decimal(body["total_cost"]) == Decimal("40.00")


# --- timeseries: agregacion diaria y borde de fecha exclusivo --------------


async def test_reports_sales_timeseries_daily_aggregation_and_date_boundary(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

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
        f"{_URL}/sales/timeseries",
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
    assert Decimal(points[0]["revenue"]) == Decimal("30.00")
    assert points[1]["date"] == today.isoformat()
    assert Decimal(points[1]["revenue"]) == Decimal("10.00")


async def test_reports_purchases_timeseries_daily_aggregation(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    today = datetime.now(timezone.utc).date()

    await _make_purchase(
        db_session, supplier, product, quantity=2, unit_cost=Decimal("6.00"),
        purchase_date=datetime.combine(today, time.min, tzinfo=timezone.utc),
    )

    response = await client.get(
        f"{_URL}/purchases/timeseries",
        headers=headers,
        params={
            "date_from": today.isoformat(),
            "date_to": (today + timedelta(days=1)).isoformat(),
        },
    )

    assert response.status_code == 200
    points = response.json()
    assert len(points) == 1
    assert points[0]["purchases_count"] == 1
    assert Decimal(points[0]["total_cost"]) == Decimal("12.00")


# --- fechas invalidas: date_from == date_to / date_from > date_to ----------


async def test_reports_date_from_not_before_date_to_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")
    today = datetime.now(timezone.utc).date()

    for path in _DATE_VALIDATED_ENDPOINTS:
        response = await client.get(
            f"{_URL}{path}",
            headers=headers,
            params={"date_from": today.isoformat(), "date_to": today.isoformat()},
        )
        assert response.status_code == 400, path


async def test_reports_date_from_after_date_to_returns_400(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    for path in _DATE_VALIDATED_ENDPOINTS:
        response = await client.get(
            f"{_URL}{path}",
            headers=headers,
            params={
                "date_from": today.isoformat(),
                "date_to": yesterday.isoformat(),
            },
        )
        assert response.status_code == 400, path


# --- top-products / top-customers / top-suppliers (venta y compra) --------


async def test_reports_sales_top_products_ordering(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

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

    by_revenue = await client.get(f"{_URL}/sales/top-products", headers=headers)
    items = by_revenue.json()
    assert items[0]["product"]["id"] == str(product_b.id)
    assert Decimal(items[0]["revenue"]) == Decimal("200.00")

    by_quantity = await client.get(
        f"{_URL}/sales/top-products", headers=headers, params={"order_by": "quantity"}
    )
    items_q = by_quantity.json()
    assert items_q[0]["product"]["id"] == str(product_a.id)


async def test_reports_sales_top_customers_ordering(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

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

    response = await client.get(f"{_URL}/sales/top-customers", headers=headers)
    items = response.json()
    assert items[0]["customer"]["id"] == str(customer_b.id)
    assert Decimal(items[0]["revenue"]) == Decimal("60.00")


async def test_reports_purchases_top_suppliers_ordering(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    supplier_a = await create_supplier(db_session)
    supplier_b = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    now = datetime.now(timezone.utc)
    await _make_purchase(
        db_session, supplier_a, product, quantity=2, unit_cost=Decimal("10.00"),
        purchase_date=now,
    )
    await _make_purchase(
        db_session, supplier_b, product, quantity=10, unit_cost=Decimal("10.00"),
        purchase_date=now,
    )

    response = await client.get(f"{_URL}/purchases/top-suppliers", headers=headers)
    items = response.json()
    assert items[0]["supplier"]["id"] == str(supplier_b.id)
    assert Decimal(items[0]["total_cost"]) == Decimal("100.00")
    assert items[1]["supplier"]["id"] == str(supplier_a.id)


async def test_reports_purchases_top_products_ordering_cost_and_quantity(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    supplier = await create_supplier(db_session)
    product_a = await create_product(db_session, tracking_type=TrackingType.BATCH)
    product_b = await create_product(db_session, tracking_type=TrackingType.BATCH)

    now = datetime.now(timezone.utc)
    # product_a: mas cantidad, menos costo total.
    await _make_purchase(
        db_session, supplier, product_a, quantity=20, unit_cost=Decimal("1.00"),
        purchase_date=now,
    )
    # product_b: menos cantidad, mas costo total.
    await _make_purchase(
        db_session, supplier, product_b, quantity=2, unit_cost=Decimal("50.00"),
        purchase_date=now,
    )

    by_cost = await client.get(f"{_URL}/purchases/top-products", headers=headers)
    items = by_cost.json()
    assert items[0]["product"]["id"] == str(product_b.id)
    assert Decimal(items[0]["total_cost"]) == Decimal("100.00")

    by_quantity = await client.get(
        f"{_URL}/purchases/top-products",
        headers=headers,
        params={"order_by": "quantity"},
    )
    items_q = by_quantity.json()
    assert items_q[0]["product"]["id"] == str(product_a.id)
    assert items_q[0]["quantity_purchased"] == 20


async def test_reports_purchases_top_products_rejects_revenue_order_by(
    client, db_session
):
    """order_by de compras usa 'cost', no 'revenue' (una compra no genera
    ingreso) -- desviacion deliberada del literal 'revenue|quantity' del
    lado ventas, reportada explicitamente en la entrega de Fase 8."""
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    response = await client.get(
        f"{_URL}/purchases/top-products",
        headers=headers,
        params={"order_by": "revenue"},
    )
    assert response.status_code == 422


# --- inventory/valuation ----------------------------------------------------


async def test_reports_inventory_valuation_serial_counts_only_in_stock(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.SERIAL)

    imei_in_stock = _unique_imei()
    imei_sold = _unique_imei()
    await _intake_serial(db_session, product, imei_in_stock, unit_cost=Decimal("90.00"))
    await _intake_serial(db_session, product, imei_sold, unit_cost=Decimal("70.00"))
    await _sell_serial(
        db_session, customer, product, imei_sold, Decimal("150.00"),
        datetime.now(timezone.utc),
    )

    response = await client.get(f"{_URL}/inventory/valuation", headers=headers)

    assert response.status_code == 200
    lines = response.json()
    assert len(lines) == 1
    assert lines[0]["product"]["id"] == str(product.id)
    assert lines[0]["quantity_on_hand"] == 1
    assert Decimal(lines[0]["total_value"]) == Decimal("90.00")


async def test_reports_inventory_valuation_batch_uses_quantity_available_not_received(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    customer = await create_customer(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    await InventoryService(db_session).register_batch_intake(
        BatchIntakeCreate(
            product_id=product.id,
            quantity=10,
            unit_cost=Decimal("5.00"),
            source_type=MovementSourceType.MANUAL,
        )
    )
    await SaleService(db_session).create_sale(
        SaleCreate(
            customer_id=customer.id,
            sale_date=datetime.now(timezone.utc),
            lines=[
                SaleLineCreate(
                    product_id=product.id, quantity=4, unit_price=Decimal("9.00")
                )
            ],
        )
    )

    response = await client.get(f"{_URL}/inventory/valuation", headers=headers)

    assert response.status_code == 200
    lines = response.json()
    assert len(lines) == 1
    assert lines[0]["quantity_on_hand"] == 6
    assert Decimal(lines[0]["total_value"]) == Decimal("30.00")
    assert Decimal(lines[0]["total_value"]) != Decimal("50.00")


# --- inventory/movements -----------------------------------------------


async def test_reports_inventory_movements_filters_and_pagination(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    supplier = await create_supplier(db_session)
    customer = await create_customer(db_session)
    product_a = await create_product(db_session, tracking_type=TrackingType.BATCH)
    product_b = await create_product(db_session, tracking_type=TrackingType.BATCH)

    now = datetime.now(timezone.utc)
    await _make_purchase(
        db_session, supplier, product_a, quantity=5, unit_cost=Decimal("4.00"),
        purchase_date=now,
    )
    await _make_purchase(
        db_session, supplier, product_b, quantity=3, unit_cost=Decimal("2.00"),
        purchase_date=now,
    )
    await SaleService(db_session).create_sale(
        SaleCreate(
            customer_id=customer.id,
            sale_date=now,
            lines=[
                SaleLineCreate(
                    product_id=product_a.id, quantity=1, unit_price=Decimal("9.00")
                )
            ],
        )
    )

    all_movements = await client.get(
        f"{_URL}/inventory/movements", headers=headers, params={"limit": 100}
    )
    assert all_movements.status_code == 200
    assert len(all_movements.json()) == 3

    by_type = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={"movement_type": "sale_out"},
    )
    assert len(by_type.json()) == 1
    assert by_type.json()[0]["movement_type"] == "sale_out"

    by_product = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={"product_id": str(product_b.id)},
    )
    items = by_product.json()
    assert len(items) == 1
    assert items[0]["product"]["id"] == str(product_b.id)

    paginated = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={"limit": 1, "offset": 1},
    )
    assert len(paginated.json()) == 1

    unknown_product = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={"product_id": str(uuid4())},
    )
    assert unknown_product.status_code == 404


async def test_reports_inventory_movements_date_range_boundary(client, db_session):
    """StockMovement.created_at es un timestamp de servidor
    (server_default=func.now()) -- no se puede fijar via purchase_date, a
    diferencia de Purchase.purchase_date. Por eso el borde se prueba con
    el "ahora" real: una compra hecha en este instante debe aparecer en
    [hoy, mañana) y no debe aparecer en [ayer, hoy), que es exactamente el
    borde exclusivo de date_to en la ventana anterior."""
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)

    await _make_purchase(
        db_session, supplier, product, quantity=1, unit_cost=Decimal("1.00"),
        purchase_date=datetime.now(timezone.utc),
    )

    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    including = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={
            "date_from": today.isoformat(),
            "date_to": (today + timedelta(days=1)).isoformat(),
        },
    )
    excluding = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={"date_from": yesterday.isoformat(), "date_to": today.isoformat()},
    )

    assert len(including.json()) == 1
    assert len(excluding.json()) == 0


# --- limites -----------------------------------------------------------


async def test_reports_limit_out_of_range_returns_422(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    for path in (
        "/sales/top-products",
        "/sales/top-customers",
        "/purchases/top-suppliers",
        "/purchases/top-products",
        "/inventory/movements",
    ):
        response = await client.get(
            f"{_URL}{path}", headers=headers, params={"limit": 999}
        )
        assert response.status_code == 422, path


async def test_reports_sales_top_products_invalid_order_by_returns_422(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    response = await client.get(
        f"{_URL}/sales/top-products", headers=headers, params={"order_by": "bogus"}
    )
    assert response.status_code == 422


async def test_reports_inventory_movements_invalid_movement_type_returns_422(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    response = await client.get(
        f"{_URL}/inventory/movements",
        headers=headers,
        params={"movement_type": "not_a_real_type"},
    )
    assert response.status_code == 422


# --- location_id ---------------------------------------------------------


async def test_reports_unknown_location_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    response = await client.get(
        f"{_URL}/sales/summary",
        headers=headers,
        params={"location_id": str(uuid4())},
    )
    assert response.status_code == 404


async def test_reports_location_filter_matches_seeded_location(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "reports.read")

    customer = await create_customer(db_session)
    product = await create_product(
        db_session, tracking_type=TrackingType.BATCH, sale_price=Decimal("15.00")
    )
    await _intake_and_sell(
        db_session, customer, product, quantity=2, unit_price=Decimal("15.00"),
        sale_date=datetime.now(timezone.utc),
    )

    seeded_location_id = await _get_seeded_location_id(db_session)

    response = await client.get(
        f"{_URL}/sales/summary",
        headers=headers,
        params={"location_id": str(seeded_location_id)},
    )
    assert response.status_code == 200
    assert Decimal(response.json()["total_amount"]) == Decimal("30.00")


# --- regresion tras el move de RecentActivityItem ---------------------


async def test_dashboard_recent_activity_still_works_after_schema_move(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "dashboard.read")

    supplier = await create_supplier(db_session)
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    await _make_purchase(
        db_session, supplier, product, quantity=1, unit_cost=Decimal("1.00"),
        purchase_date=datetime.now(timezone.utc),
    )

    response = await client.get(
        "/api/v1/dashboard/recent-activity", headers=headers
    )

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["product"]["id"] == str(product.id)
    assert items[0]["location"]["id"]


async def test_existing_sales_purchases_inventory_endpoints_still_work(
    client, db_session
):
    _, sales_headers = await _issue_user_with_permissions(db_session, "sales.read")
    _, purchases_headers = await _issue_user_with_permissions(
        db_session, "purchases.read"
    )
    product = await create_product(db_session, tracking_type=TrackingType.BATCH)
    _, inventory_headers = await _issue_user_with_permissions(
        db_session, "inventory.read"
    )

    sales_response = await client.get("/api/v1/sales", headers=sales_headers)
    purchases_response = await client.get(
        "/api/v1/purchases", headers=purchases_headers
    )
    inventory_response = await client.get(
        f"/api/v1/inventory/products/{product.id}/stock", headers=inventory_headers
    )

    assert sales_response.status_code == 200
    assert purchases_response.status_code == 200
    assert inventory_response.status_code == 200
