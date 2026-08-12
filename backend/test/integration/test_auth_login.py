"""Tests de integracion HTTP para POST /auth/login y POST /auth/refresh.

Sin mocks: cada test pasa por el AuthService real y, cuando corresponde,
por JWTHandler real. Los casos negativos de token (expirado, firma
invalida, tipo incorrecto) se fabrican con JWTHandler._create_token o con
jwt.encode a mano usando el secreto/algoritmo reales de settings.security
-- nunca se mockea JWTHandler ni PyJWT. La expiracion instantanea se logra
con expires_delta negativo, nunca con sleep().

Mensajes esperados, confirmados leyendo AuthService directamente:
- login: "Invalid email or password." (usuario inexistente, password
  incorrecto e inactivo son deliberadamente indistinguibles).
- refresh: "Invalid or expired refresh token." (token invalido, expirado,
  tipo incorrecto o usuario inactivo/inexistente son igual de
  indistinguibles).
"""
from datetime import timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.config.settings import settings
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.auth.services.user_service import UserService
from factories import DEFAULT_TEST_PASSWORD, create_user

_LOGIN_URL = "/api/v1/auth/login"
_REFRESH_URL = "/api/v1/auth/refresh"

_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password."
_INVALID_REFRESH_TOKEN_MESSAGE = "Invalid or expired refresh token."


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


# --- POST /auth/login -------------------------------------------------


async def test_login_with_valid_credentials_returns_tokens(client, db_session):
    user = await create_user(db_session)

    response = await client.post(
        _LOGIN_URL,
        json={"email": user.email, "password": DEFAULT_TEST_PASSWORD},
    )

    assert response.status_code == 200
    body = response.json()

    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.security.access_token_expire_minutes * 60

    access_payload = JWTHandler.decode_token(body["access_token"])
    refresh_payload = JWTHandler.decode_token(body["refresh_token"])

    assert access_payload.type == "access"
    assert access_payload.sub == user.id
    assert refresh_payload.type == "refresh"
    assert refresh_payload.sub == user.id


async def test_login_with_wrong_password_returns_generic_401(client, db_session):
    user = await create_user(db_session)

    response = await client.post(
        _LOGIN_URL,
        json={"email": user.email, "password": "wrong-password-xyz"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


async def test_login_with_nonexistent_email_returns_same_generic_401(
    client, db_session
):
    user = await create_user(db_session)

    wrong_password_response = await client.post(
        _LOGIN_URL,
        json={"email": user.email, "password": "wrong-password-xyz"},
    )

    nonexistent_response = await client.post(
        _LOGIN_URL,
        json={
            "email": "nonexistent-xyz@mobileerp-test.dev",
            "password": "whatever123",
        },
    )

    assert nonexistent_response.status_code == 401
    assert (
        nonexistent_response.json()["detail"]
        == wrong_password_response.json()["detail"]
        == _INVALID_CREDENTIALS_MESSAGE
    )


async def test_login_with_inactive_user_returns_401(client, db_session):
    user = await create_user(db_session)
    await UserService(db_session).deactivate_user(user.id)

    response = await client.post(
        _LOGIN_URL,
        json={"email": user.email, "password": DEFAULT_TEST_PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_CREDENTIALS_MESSAGE


# --- POST /auth/refresh -------------------------------------------------


async def test_refresh_with_valid_refresh_token_returns_new_tokens(
    client, db_session
):
    user = await create_user(db_session)

    login_response = await client.post(
        _LOGIN_URL,
        json={"email": user.email, "password": DEFAULT_TEST_PASSWORD},
    )
    refresh_token = login_response.json()["refresh_token"]

    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 200
    body = response.json()

    new_access_payload = JWTHandler.decode_token(body["access_token"])
    new_refresh_payload = JWTHandler.decode_token(body["refresh_token"])

    assert new_access_payload.type == "access"
    assert new_access_payload.sub == user.id
    assert new_refresh_payload.type == "refresh"
    assert new_refresh_payload.sub == user.id


async def test_refresh_with_invalid_refresh_token_returns_401(client):
    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": "not-a-real-jwt-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_REFRESH_TOKEN_MESSAGE


async def test_refresh_with_expired_refresh_token_returns_401(client, db_session):
    user = await create_user(db_session)
    expired_token = JWTHandler._create_token(
        user.id, token_type="refresh", expires_delta=timedelta(seconds=-1)
    )

    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": expired_token},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_REFRESH_TOKEN_MESSAGE


async def test_refresh_with_access_token_used_as_refresh_returns_401(
    client, db_session
):
    user = await create_user(db_session)
    access_token = JWTHandler.create_access_token(user.id)

    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": access_token},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_REFRESH_TOKEN_MESSAGE


async def test_refresh_with_invalid_signature_returns_401(client, db_session):
    user = await create_user(db_session)
    valid_refresh_token = JWTHandler.create_refresh_token(user.id)
    claims = _decode_raw(valid_refresh_token)
    tampered_token = _sign_with_wrong_secret(claims)

    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": tampered_token},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_REFRESH_TOKEN_MESSAGE


async def test_refresh_for_inactive_user_returns_401(client, db_session):
    user = await create_user(db_session)
    refresh_token = JWTHandler.create_refresh_token(user.id)

    await UserService(db_session).deactivate_user(user.id)

    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_REFRESH_TOKEN_MESSAGE


async def test_refresh_for_nonexistent_user_returns_401(client):
    refresh_token = JWTHandler.create_refresh_token(uuid4())

    response = await client.post(
        _REFRESH_URL,
        json={"refresh_token": refresh_token},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == _INVALID_REFRESH_TOKEN_MESSAGE
