"""Regresion BUG #002: revive-on-create para Brand, Category y Supplier.

Cuando una entidad de catalogo con nombre unico se elimina (soft-delete,
is_active=False) y luego se vuelve a crear con el mismo nombre, el Service
reactiva la fila existente en vez de fallar con 409 -- conservando el mismo
UUID y todas sus relaciones historicas (product.brand_id / product.category_id
/ purchase.supplier_id siguen apuntando al mismo registro). Un nombre que
pertenece a una entidad ACTIVA sigue devolviendo 409 con el mensaje de
siempre.

Sin mocks, sin sleep(), SAVEPOINT por test via `client`/`db_session`. El
caso concurrente real (dos POST simultaneos revivendo la misma fila) vive
en test/concurrency/test_concurrency_brand_revive_on_create.py.
"""
from uuid import uuid4

import pytest

from app.modules.auth.security.jwt_handler import JWTHandler
from factories import (
    create_brand,
    create_category,
    create_role_with_permission,
    create_supplier,
    create_user,
)

_API = "/api/v1"


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _issue_user_with_permissions(db_session, *permission_codes):
    roles = [
        await create_role_with_permission(db_session, code)
        for code in permission_codes
    ]
    user = await create_user(db_session, role_ids=[role.id for role in roles])
    return _bearer(JWTHandler.create_access_token(user.id))


# entity -> (url, factory, conflict_message, (permission_codes...))
_CASES = {
    "brand": (
        f"{_API}/brands",
        create_brand,
        "Brand already exists.",
        ("brands.create", "brands.read", "brands.delete"),
    ),
    "category": (
        f"{_API}/categories",
        create_category,
        "Category already exists.",
        ("categories.create", "categories.read", "categories.delete"),
    ),
    "supplier": (
        f"{_API}/suppliers",
        create_supplier,
        "Supplier already exists.",
        ("suppliers.create", "suppliers.read", "suppliers.delete"),
    ),
}


@pytest.mark.parametrize("entity", list(_CASES))
async def test_recreate_after_soft_delete_revives_same_row(
    entity, client, db_session
):
    url, _factory, _message, perms = _CASES[entity]
    headers = await _issue_user_with_permissions(db_session, *perms)

    name = f"Revive-{uuid4().hex[:10]}"

    # 1. crear la entidad
    created = await client.post(url, headers=headers, json={"name": name})
    assert created.status_code == 201
    original_id = created.json()["id"]
    assert created.json()["is_active"] is True

    # 2. desactivarla mediante el flujo existente (soft-delete)
    deleted = await client.delete(f"{url}/{original_id}", headers=headers)
    assert deleted.status_code == 204

    # 3. confirmar que quedo is_active=False
    fetched = await client.get(f"{url}/{original_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["is_active"] is False

    # 4-5. volver a crear con el mismo nombre -> respuesta exitosa y activa
    revived = await client.post(url, headers=headers, json={"name": name})
    assert revived.status_code == 201
    body = revived.json()
    assert body["is_active"] is True

    # 6-7. el UUID es exactamente el original: se reutilizo la fila
    assert body["id"] == original_id

    # y no se creo una segunda fila: el listado activo tiene exactamente una
    listing = await client.get(url, headers=headers)
    matching = [row for row in listing.json() if row["name"] == name]
    assert len(matching) == 1
    assert matching[0]["id"] == original_id


@pytest.mark.parametrize("entity", list(_CASES))
async def test_create_brand_new_name_still_succeeds(entity, client, db_session):
    url, _factory, _message, perms = _CASES[entity]
    headers = await _issue_user_with_permissions(db_session, *perms)

    response = await client.post(
        url, headers=headers, json={"name": f"Fresh-{uuid4().hex[:10]}"}
    )

    assert response.status_code == 201
    assert response.json()["is_active"] is True


@pytest.mark.parametrize("entity", list(_CASES))
async def test_create_with_active_name_still_returns_409(
    entity, client, db_session
):
    url, factory, message, perms = _CASES[entity]
    headers = await _issue_user_with_permissions(db_session, *perms)

    existing = await factory(db_session)

    response = await client.post(
        url, headers=headers, json={"name": existing.name}
    )

    assert response.status_code == 409
    assert response.json()["detail"] == message
