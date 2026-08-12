"""Tests de integracion HTTP para /users (Etapa 5).

No repite los casos 401 genericos ni la mecanica de require_role ya
probada exhaustivamente en Etapa 4 sobre GET /users -- se enfoca en las
reglas de negocio de UserService expuestas via HTTP: CRUD, filtrado de
activos, el guard de "no dejar el sistema sin ningun ADMIN activo", y el
chequeo de ownership de PUT /users/{id}/password (logica nueva, inline en
el router, no cubierta en Etapa 4).

Sin mocks, sin live_client: todo pasa por `client` + `db_session`
(SAVEPOINT por test). El test de cambio de password exitoso hace un login
real como verificacion end-to-end de que el nuevo password quedo
efectivamente aplicado -- no es un test nuevo de login, es el oraculo de
verificacion de esa unica aserccion.
"""
from uuid import uuid4

from app.modules.auth.repositories.user_repository import UserRepository
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.auth.services.role_service import RoleService
from app.modules.auth.services.user_service import UserService
from factories import DEFAULT_TEST_PASSWORD, create_admin, create_role, create_user

_USERS_URL = "/api/v1/users"
_LOGIN_URL = "/api/v1/auth/login"

_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."
_LAST_ADMIN_MESSAGE = (
    "This operation would leave the system without any active "
    "ADMIN user."
)


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _issue_admin(db_session):
    admin = await create_admin(db_session)
    headers = _bearer(JWTHandler.create_access_token(admin.id))
    return admin, headers


def _unique_email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@mobileerp-test.dev"


# --- 1-3: POST /users -----------------------------------------------------


async def test_create_user_without_roles_returns_201(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.post(
        _USERS_URL,
        headers=headers,
        json={
            "email": _unique_email("new-user"),
            "full_name": "New User",
            "password": "Sup3rSecretQA!",
            "role_ids": [],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["roles"] == []
    assert body["is_active"] is True


async def test_create_user_with_roles_returns_201(client, db_session):
    _, headers = await _issue_admin(db_session)
    role = await create_role(db_session)

    response = await client.post(
        _USERS_URL,
        headers=headers,
        json={
            "email": _unique_email("new-user-with-role"),
            "full_name": "New User With Role",
            "password": "Sup3rSecretQA!",
            "role_ids": [str(role.id)],
        },
    )

    assert response.status_code == 201
    assert [r["id"] for r in response.json()["roles"]] == [str(role.id)]


async def test_create_user_with_duplicate_email_returns_409(client, db_session):
    _, headers = await _issue_admin(db_session)
    existing = await create_user(db_session)

    response = await client.post(
        _USERS_URL,
        headers=headers,
        json={
            "email": existing.email,
            "full_name": "Duplicate",
            "password": "Sup3rSecretQA!",
            "role_ids": [],
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered."


# --- 4-6: GET /users, GET /users/{id} --------------------------------------


async def test_get_user_by_id_returns_200(client, db_session):
    _, headers = await _issue_admin(db_session)
    user = await create_user(db_session)

    response = await client.get(f"{_USERS_URL}/{user.id}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(user.id)
    assert body["email"] == user.email


async def test_get_user_not_found_returns_404(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.get(f"{_USERS_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found."


async def test_get_users_lists_only_active_users(client, db_session):
    _, headers = await _issue_admin(db_session)
    active_user = await create_user(db_session)
    inactive_user = await create_user(db_session)
    await UserService(db_session).deactivate_user(inactive_user.id)

    response = await client.get(_USERS_URL, headers=headers)

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()]
    assert active_user.email in emails
    assert inactive_user.email not in emails


# --- 7-8: PUT /users/{id} --------------------------------------------------


async def test_update_user_changes_email_and_full_name(client, db_session):
    _, headers = await _issue_admin(db_session)
    user = await create_user(db_session)
    new_email = _unique_email("updated")

    response = await client.put(
        f"{_USERS_URL}/{user.id}",
        headers=headers,
        json={"email": new_email, "full_name": "Updated Name"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == new_email
    assert body["full_name"] == "Updated Name"


async def test_update_user_with_duplicate_email_returns_409(client, db_session):
    _, headers = await _issue_admin(db_session)
    user_a = await create_user(db_session)
    user_b = await create_user(db_session)

    response = await client.put(
        f"{_USERS_URL}/{user_b.id}",
        headers=headers,
        json={"email": user_a.email},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered."


# --- 9-11: DELETE /users/{id} ----------------------------------------------


async def test_deactivate_user_succeeds_for_regular_user(client, db_session):
    _, headers = await _issue_admin(db_session)
    user = await create_user(db_session)

    response = await client.delete(f"{_USERS_URL}/{user.id}", headers=headers)

    assert response.status_code == 204

    refreshed = await UserRepository(db_session).get_by_id(user.id)
    assert refreshed.is_active is False


async def test_deactivate_last_active_admin_returns_400(client, db_session):
    admin, headers = await _issue_admin(db_session)

    response = await client.delete(f"{_USERS_URL}/{admin.id}", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == _LAST_ADMIN_MESSAGE


async def test_deactivate_user_not_found_returns_404(client, db_session):
    _, headers = await _issue_admin(db_session)

    response = await client.delete(f"{_USERS_URL}/{uuid4()}", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "User not found."


# --- 12-15: PUT /users/{id}/roles ------------------------------------------


async def test_assign_roles_success(client, db_session):
    _, headers = await _issue_admin(db_session)
    user = await create_user(db_session)
    role = await create_role(db_session)

    response = await client.put(
        f"{_USERS_URL}/{user.id}/roles",
        headers=headers,
        json={"role_ids": [str(role.id)]},
    )

    assert response.status_code == 200
    assert [r["id"] for r in response.json()["roles"]] == [str(role.id)]


async def test_assign_roles_with_unknown_role_id_returns_404(client, db_session):
    _, headers = await _issue_admin(db_session)
    user = await create_user(db_session)

    response = await client.put(
        f"{_USERS_URL}/{user.id}/roles",
        headers=headers,
        json={"role_ids": [str(uuid4())]},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


async def test_assign_roles_with_inactive_role_returns_400(client, db_session):
    _, headers = await _issue_admin(db_session)
    user = await create_user(db_session)
    role = await create_role(db_session)
    await RoleService(db_session).deactivate_role(role.id)

    response = await client.put(
        f"{_USERS_URL}/{user.id}/roles",
        headers=headers,
        json={"role_ids": [str(role.id)]},
    )

    assert response.status_code == 400
    assert "not active" in response.json()["detail"]


async def test_assign_roles_removing_last_active_admin_returns_400(
    client, db_session
):
    admin, headers = await _issue_admin(db_session)

    response = await client.put(
        f"{_USERS_URL}/{admin.id}/roles",
        headers=headers,
        json={"role_ids": []},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == _LAST_ADMIN_MESSAGE


# --- 16-18: PUT /users/{id}/password ---------------------------------------


async def test_change_password_succeeds_and_new_password_works_on_login(
    client, db_session
):
    user = await create_user(db_session)
    headers = _bearer(JWTHandler.create_access_token(user.id))
    new_password = "N3wSup3rSecret!"

    response = await client.put(
        f"{_USERS_URL}/{user.id}/password",
        headers=headers,
        json={
            "current_password": DEFAULT_TEST_PASSWORD,
            "new_password": new_password,
        },
    )

    assert response.status_code == 204

    login_response = await client.post(
        _LOGIN_URL,
        json={"email": user.email, "password": new_password},
    )
    assert login_response.status_code == 200


async def test_change_password_with_wrong_current_password_returns_400(
    client, db_session
):
    user = await create_user(db_session)
    headers = _bearer(JWTHandler.create_access_token(user.id))

    response = await client.put(
        f"{_USERS_URL}/{user.id}/password",
        headers=headers,
        json={
            "current_password": "totally-wrong-password",
            "new_password": "N3wSup3rSecret!",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect."


async def test_change_password_for_another_user_returns_403(client, db_session):
    user = await create_user(db_session)
    other_user = await create_user(db_session)
    headers = _bearer(JWTHandler.create_access_token(user.id))

    response = await client.put(
        f"{_USERS_URL}/{other_user.id}/password",
        headers=headers,
        json={
            "current_password": DEFAULT_TEST_PASSWORD,
            "new_password": "N3wSup3rSecret!",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only change your own password."


# --- 32: wiring sanity ------------------------------------------------------


async def test_create_user_without_admin_role_returns_403(client, db_session):
    user = await create_user(db_session)
    headers = _bearer(JWTHandler.create_access_token(user.id))

    response = await client.post(
        _USERS_URL,
        headers=headers,
        json={
            "email": _unique_email("blocked"),
            "full_name": "Should Not Be Created",
            "password": "Sup3rSecretQA!",
            "role_ids": [],
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE
