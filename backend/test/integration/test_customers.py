"""Tests de integracion HTTP para /customers (Etapa 6a).

Todos los endpoints estan guardados por require_permission (no
require_role) -- cada test arma un usuario con exactamente los permisos
que necesita via create_role_with_permission (Etapa 4), un rol por
permiso, todos asignados al mismo usuario. require_permission resuelve
la union de permisos de todos los roles activos del usuario, asi que
varios roles de un solo permiso cada uno cubren un usuario que necesita
varios permisos, sin tocar factories.py.

Sin mocks, sin live_client (ningun caso de Customer requiere
independencia real de transacciones -- eso queda para Inventory #34).
Sin sleep(). SAVEPOINT por test via `db_session`/`client`.
"""
from uuid import uuid4

from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.customer.schemas.customer_create import CustomerCreate
from app.modules.customer.services.customer_service import CustomerService
from factories import create_role_with_permission, create_user

_CUSTOMERS_URL = "/api/v1/customers"

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


async def _create_customer(
    db_session,
    name: str | None = None,
    document_id: str | None = None,
):
    service = CustomerService(db_session)
    return await service.create_customer(
        CustomerCreate(
            name=name or f"Customer-{uuid4().hex[:10]}",
            document_id=document_id,
        )
    )


def _unique_document_id() -> str:
    return uuid4().hex[:12]


# --- 1-2: POST /customers ---------------------------------------------------


async def test_create_customer_success(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "customers.create")

    response = await client.post(
        _CUSTOMERS_URL,
        headers=headers,
        json={"name": "Juan Perez"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Juan Perez"
    assert body["is_active"] is True
    assert body["is_default_customer"] is False


async def test_create_customer_with_duplicate_document_id_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "customers.create")
    document_id = _unique_document_id()
    await _create_customer(db_session, document_id=document_id)

    response = await client.post(
        _CUSTOMERS_URL,
        headers=headers,
        json={"name": "Otro Cliente", "document_id": document_id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Document ID already registered."


# --- 3-5: GET /customers, GET /customers/{id} -------------------------------


async def test_get_customer_by_id_returns_200(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "customers.read")
    customer = await _create_customer(db_session)

    response = await client.get(
        f"{_CUSTOMERS_URL}/{customer.id}", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["id"] == str(customer.id)


async def test_get_customer_not_found_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "customers.read")

    response = await client.get(f"{_CUSTOMERS_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found."


async def test_get_customers_lists_only_active(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.read", "customers.delete"
    )
    active_customer = await _create_customer(db_session)
    inactive_customer = await _create_customer(db_session)
    await CustomerService(db_session).delete_customer(inactive_customer.id)

    response = await client.get(_CUSTOMERS_URL, headers=headers)

    assert response.status_code == 200
    names = [row["name"] for row in response.json()]
    assert active_customer.name in names
    assert inactive_customer.name not in names


# --- 6-7: PUT /customers/{id} -----------------------------------------------


async def test_update_customer_success(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "customers.update")
    customer = await _create_customer(db_session)

    response = await client.put(
        f"{_CUSTOMERS_URL}/{customer.id}",
        headers=headers,
        json={"name": "Nombre Actualizado", "phone": "555-1234"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Nombre Actualizado"
    assert body["phone"] == "555-1234"


async def test_update_customer_with_duplicate_document_id_returns_409(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(db_session, "customers.update")
    document_id = _unique_document_id()
    await _create_customer(db_session, document_id=document_id)
    other_customer = await _create_customer(db_session)

    response = await client.put(
        f"{_CUSTOMERS_URL}/{other_customer.id}",
        headers=headers,
        json={"document_id": document_id},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Document ID already registered."


# --- 8: DELETE /customers/{id} ----------------------------------------------


async def test_deactivate_customer_succeeds_and_is_excluded_from_listing(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.delete", "customers.read"
    )
    customer = await _create_customer(db_session)

    response = await client.delete(
        f"{_CUSTOMERS_URL}/{customer.id}", headers=headers
    )

    assert response.status_code == 204

    listing_response = await client.get(_CUSTOMERS_URL, headers=headers)
    names = [row["name"] for row in listing_response.json()]
    assert customer.name not in names


# --- 9-13: PUT /customers/{id}/default --------------------------------------


async def test_set_default_customer_without_prior_default_succeeds(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.manage_default"
    )
    customer = await _create_customer(db_session)

    response = await client.put(
        f"{_CUSTOMERS_URL}/{customer.id}/default", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["is_default_customer"] is True


async def test_set_default_customer_already_default_is_idempotent(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.manage_default"
    )
    customer = await _create_customer(db_session)
    await CustomerService(db_session).set_default_customer(customer.id)

    response = await client.put(
        f"{_CUSTOMERS_URL}/{customer.id}/default", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["is_default_customer"] is True


async def test_set_default_customer_replaces_previous_default(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.manage_default", "customers.read"
    )
    previous_default = await _create_customer(db_session)
    await CustomerService(db_session).set_default_customer(previous_default.id)
    new_default = await _create_customer(db_session)

    response = await client.put(
        f"{_CUSTOMERS_URL}/{new_default.id}/default", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["is_default_customer"] is True

    # `set_default_customer` deja el atributo `updated_at` del default
    # anterior expirado tras su flush() interno (columna con onupdate en
    # servidor) sin refrescarlo -- en produccion esto nunca se nota porque
    # cada request usa su propia sesion nueva; aca ambas requests comparten
    # `db_session`, asi que el mismo objeto Python sigue vivo en el mapa de
    # identidad. Se refresca explicitamente para que la comprobacion
    # siguiente no dispare una carga perezosa fuera de un contexto async.
    await db_session.refresh(previous_default)

    previous_response = await client.get(
        f"{_CUSTOMERS_URL}/{previous_default.id}", headers=headers
    )
    assert previous_response.json()["is_default_customer"] is False


async def test_set_default_customer_on_inactive_customer_returns_400(
    client, db_session
):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.manage_default", "customers.delete"
    )
    customer = await _create_customer(db_session)
    await CustomerService(db_session).delete_customer(customer.id)

    response = await client.put(
        f"{_CUSTOMERS_URL}/{customer.id}/default", headers=headers
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Customer is not active."


async def test_set_default_customer_not_found_returns_404(client, db_session):
    _, headers = await _issue_user_with_permissions(
        db_session, "customers.manage_default"
    )

    response = await client.put(
        f"{_CUSTOMERS_URL}/{uuid4()}/default", headers=headers
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Customer not found."


# --- 14: wiring sanity -------------------------------------------------------


async def test_create_customer_without_permission_returns_403(client, db_session):
    _, headers = await _issue_user_with_permissions(db_session, "customers.read")

    response = await client.post(
        _CUSTOMERS_URL,
        headers=headers,
        json={"name": "Should Not Be Created"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE
