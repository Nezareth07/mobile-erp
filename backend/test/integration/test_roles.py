"""Tests de integracion HTTP para /roles y /permissions (Etapa 5).

Igual que test_users.py, no repite la mecanica generica de require_role
ya probada en Etapa 4 -- se enfoca en las reglas de negocio de
RoleService/PermissionService expuestas via HTTP: CRUD, filtrado de
activos, el guard de "no desactivar un rol con usuarios activos
asignados", y el listado de permisos sembrados por las migraciones.

Sin mocks, sin live_client: todo pasa por `client` + `db_session`
(SAVEPOINT por test). GET /permissions se agrupa aqui (no en un archivo
separado) porque es un unico endpoint de solo lectura sin logica de
negocio propia mas alla de listar.
"""
from uuid import uuid4

from app.modules.auth.repositories.permission_repository import (
    PermissionRepository,
)
from app.modules.auth.repositories.role_repository import RoleRepository
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.auth.services.role_service import RoleService
from factories import create_admin, create_role, create_user

_ROLES_URL = "/api/v1/roles"
_PERMISSIONS_URL = "/api/v1/permissions"

_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _issue_admin(db_session):
    admin = await create_admin(db_session)
    headers = _bearer(JWTHandler.create_access_token(admin.id))
    return admin, headers


def _unique_role_name(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:8]}"


# --- 19-20: POST /roles -----------------------------------------------------


async def test_create_role_success(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.post(
        _ROLES_URL,
        headers=headers,
        json={
            "name": _unique_role_name("ROLE"),
            "description": "A test role",
        },
    )

    assert response.status_code == 201
    assert response.json()["is_active"] is True


async def test_create_role_with_duplicate_name_returns_409(client, db_session):
    _, headers = await _issue_admin(db_session)
    existing = await create_role(db_session)

    response = await client.post(
        _ROLES_URL,
        headers=headers,
        json={"name": existing.name},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Role already exists."


# --- 21-23: GET /roles, GET /roles/{id} -------------------------------------


async def test_get_role_by_id_returns_200(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)

    response = await client.get(f"{_ROLES_URL}/{role.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == str(role.id)


async def test_get_role_not_found_returns_404(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.get(f"{_ROLES_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Role not found."


async def test_get_roles_lists_only_active_roles(client, db_session):
    _, headers = await _issue_admin(db_session)
    active_role = await create_role(db_session)
    inactive_role = await create_role(db_session)
    await RoleService(db_session).deactivate_role(inactive_role.id)

    response = await client.get(_ROLES_URL, headers=headers)

    assert response.status_code == 200
    names = [row["name"] for row in response.json()]
    assert active_role.name in names
    assert inactive_role.name not in names


# --- 24-25: PUT /roles/{id} --------------------------------------------------


async def test_update_role_renames_successfully(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)
    new_name = _unique_role_name("RENAMED")

    response = await client.put(
        f"{_ROLES_URL}/{role.id}",
        headers=headers,
        json={"name": new_name},
    )

    assert response.status_code == 200
    assert response.json()["name"] == new_name


async def test_update_role_with_duplicate_name_returns_409(client, db_session):
    _, headers = await _issue_admin(db_session)
    role_a = await create_role(db_session)
    role_b = await create_role(db_session)

    response = await client.put(
        f"{_ROLES_URL}/{role_b.id}",
        headers=headers,
        json={"name": role_a.name},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Role already exists."


# --- 26-28: DELETE /roles/{id} ------------------------------------------------


async def test_deactivate_role_succeeds_without_active_users(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)

    response = await client.delete(f"{_ROLES_URL}/{role.id}", headers=headers)

    assert response.status_code == 204

    refreshed = await RoleRepository(db_session).get_by_id(role.id)
    assert refreshed.is_active is False


async def test_deactivate_role_blocked_when_it_has_active_users(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)
    await create_user(db_session, role_ids=[role.id])

    response = await client.delete(f"{_ROLES_URL}/{role.id}", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "Cannot deactivate a role that has active users assigned."
    )


async def test_deactivate_role_not_found_returns_404(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.delete(f"{_ROLES_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Role not found."


# --- 29-30: PUT /roles/{id}/permissions ---------------------------------------


async def test_assign_permissions_success(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)
    permission = await PermissionRepository(db_session).get_by_code(
        "brands.read"
    )

    response = await client.put(
        f"{_ROLES_URL}/{role.id}/permissions",
        headers=headers,
        json={"permission_ids": [str(permission.id)]},
    )

    assert response.status_code == 200
    assert [p["id"] for p in response.json()["permissions"]] == [
        str(permission.id)
    ]


async def test_assign_permissions_with_unknown_id_returns_404(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)

    response = await client.put(
        f"{_ROLES_URL}/{role.id}/permissions",
        headers=headers,
        json={"permission_ids": [str(uuid4())]},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


# --- 31: GET /permissions ------------------------------------------------------


async def test_get_permissions_returns_seeded_permissions(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.get(_PERMISSIONS_URL, headers=headers)

    assert response.status_code == 200

    codes_from_api = {row["code"] for row in response.json()}
    codes_from_db = {
        permission.code
        for permission in await PermissionRepository(db_session).get_all()
    }

    assert codes_from_api == codes_from_db
    assert len(codes_from_api) > 0


# --- 33-34: wiring sanity --------------------------------------------------------


async def test_create_role_without_admin_role_returns_403(client, db_session):
    user = await create_user(db_session)
    headers = _bearer(JWTHandler.create_access_token(user.id))

    response = await client.post(
        _ROLES_URL,
        headers=headers,
        json={"name": _unique_role_name("BLOCKED")},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE


async def test_get_permissions_without_admin_role_returns_403(client, db_session):
    user = await create_user(db_session)
    headers = _bearer(JWTHandler.create_access_token(user.id))

    response = await client.get(_PERMISSIONS_URL, headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE
