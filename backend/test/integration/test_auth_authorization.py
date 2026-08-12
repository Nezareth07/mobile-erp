"""Tests de integracion HTTP para autenticacion y autorizacion sobre
endpoints protegidos.

Se usan dos endpoints como sondas, ya elegidos y confirmados con el
usuario:
- GET /api/v1/users      -> guardado por require_role("ADMIN")
- GET /api/v1/brands     -> guardado por require_permission("brands.read")

Ninguno de los dos prueba su propia logica de negocio aqui (eso es
alcance de una etapa futura de Users/Roles) -- solo se usan como sondas
del guard de autenticacion/autorizacion.

Sin mocks: los tokens negativos (expirado, firma invalida, tipo
incorrecto) se fabrican con JWTHandler._create_token o con jwt.encode a
mano usando el secreto/algoritmo reales, igual que en test_auth_login.py.

Mensajes esperados, confirmados leyendo dependencies.py directamente:
- get_current_user (sin token / token invalido / expirado / firma
  invalida / tipo incorrecto / usuario inactivo o inexistente):
  "Could not validate credentials." (401) -- mensaje DISTINTO al de
  AuthService.login/refresh.
- require_role / require_permission: "You do not have permission to
  perform this action." (403).
"""
from datetime import timedelta

import jwt

from app.core.config.settings import settings
from app.modules.auth.repositories.role_repository import RoleRepository
from app.modules.auth.schemas.user_role_assignment import UserRoleAssignment
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.auth.services.user_service import UserService
from factories import create_admin, create_role_with_permission, create_user

_USERS_URL = "/api/v1/users"
_BRANDS_URL = "/api/v1/brands"

_INVALID_CREDENTIALS_MESSAGE = "Could not validate credentials."
_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _sign_with_wrong_secret(claims: dict) -> str:
    return jwt.encode(
        claims,
        "a-completely-different-secret-key",
        algorithm=settings.security.algorithm,
    )


def _decode_raw(token: str) -> dict:
    return jwt.decode(
        token,
        settings.security.secret_key.get_secret_value(),
        algorithms=[settings.security.algorithm],
    )


# --- autenticacion sobre endpoint protegido -----------------------------


async def test_protected_endpoint_without_token_returns_401(client):
    response = await client.get(_USERS_URL)

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


async def test_protected_endpoint_with_invalid_token_returns_401(client):
    response = await client.get(_USERS_URL, headers=_bearer("not-a-real-jwt"))

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


async def test_protected_endpoint_with_expired_access_token_returns_401(
    client, db_session
):
    user = await create_user(db_session)
    expired_token = JWTHandler._create_token(
        user.id, token_type="access", expires_delta=timedelta(seconds=-1)
    )

    response = await client.get(_USERS_URL, headers=_bearer(expired_token))

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


async def test_protected_endpoint_with_invalid_signature_returns_401(
    client, db_session
):
    user = await create_user(db_session)
    valid_access_token = JWTHandler.create_access_token(user.id)
    claims = _decode_raw(valid_access_token)
    tampered_token = _sign_with_wrong_secret(claims)

    response = await client.get(_USERS_URL, headers=_bearer(tampered_token))

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


async def test_protected_endpoint_with_refresh_token_used_as_access_returns_401(
    client, db_session
):
    user = await create_user(db_session)
    refresh_token = JWTHandler.create_refresh_token(user.id)

    response = await client.get(_USERS_URL, headers=_bearer(refresh_token))

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


# --- autorizacion por rol (require_role) --------------------------------


async def test_role_protected_endpoint_without_required_role_returns_403(
    client, db_session
):
    user = await create_user(db_session)
    access_token = JWTHandler.create_access_token(user.id)

    response = await client.get(_USERS_URL, headers=_bearer(access_token))

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE


async def test_role_protected_endpoint_with_required_role_returns_200(
    client, db_session
):
    admin = await create_admin(db_session)
    access_token = JWTHandler.create_access_token(admin.id)

    response = await client.get(_USERS_URL, headers=_bearer(access_token))

    assert response.status_code == 200
    emails = [row["email"] for row in response.json()]
    assert admin.email in emails


# --- autorizacion por permiso (require_permission) -----------------------


async def test_permission_protected_endpoint_without_permission_returns_403(
    client, db_session
):
    user = await create_user(db_session)
    access_token = JWTHandler.create_access_token(user.id)

    response = await client.get(_BRANDS_URL, headers=_bearer(access_token))

    assert response.status_code == 403
    assert response.json()["detail"] == _FORBIDDEN_MESSAGE


async def test_permission_protected_endpoint_with_permission_returns_200(
    client, db_session
):
    role = await create_role_with_permission(db_session, "brands.read")
    user = await create_user(db_session, role_ids=[role.id])
    access_token = JWTHandler.create_access_token(user.id)

    response = await client.get(_BRANDS_URL, headers=_bearer(access_token))

    assert response.status_code == 200
    assert isinstance(response.json(), list)


# --- regresion ancla: resolucion desde DB, no desde claims ---------------


async def test_roles_and_permissions_are_resolved_from_db_not_jwt_claims(
    client, db_session
):
    # 1. usuario sin ADMIN
    user = await create_user(db_session)

    # 2. emitir access token mientras el usuario todavia no tiene ADMIN
    access_token = JWTHandler.create_access_token(user.id)

    # 3. GET /users -> 403
    forbidden_response = await client.get(_USERS_URL, headers=_bearer(access_token))
    assert forbidden_response.status_code == 403
    assert forbidden_response.json()["detail"] == _FORBIDDEN_MESSAGE

    # 4. asignar ADMIN en DB (mismo db_session/misma transaccion de test)
    admin_role = await RoleRepository(db_session).get_by_name("ADMIN")
    await UserService(db_session).assign_roles(
        user.id, UserRoleAssignment(role_ids=[admin_role.id])
    )

    # 5. reutilizar exactamente el mismo access token, sin reemitirlo
    # 6. GET /users -> 200
    authorized_response = await client.get(_USERS_URL, headers=_bearer(access_token))
    assert authorized_response.status_code == 200
