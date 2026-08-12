"""Tests unitarios puros de JWTHandler -- sin Postgres, sin app, sin
mocks: se ejercita directamente la clase real, incluyendo su metodo
"privado" _create_token para generar tokens ya expirados de forma
instantanea (sin sleep() ni freezegun).

Para los casos de rechazo (firma invalida, algoritmo invalido, claim
obligatorio ausente, claims malformados) se fabrican tokens a mano con
`jwt.encode` directamente, usando el mismo secret/algoritmo reales de
`settings.security` cuando corresponde, y luego se pasan a
JWTHandler.decode_token() -- nunca se mockea PyJWT ni JWTHandler.

Comportamiento confirmado empiricamente contra PyJWT 2.13.0 antes de
escribir las aserciones:
- claim requerido ausente -> jwt.MissingRequiredClaimError
- algoritmo no permitido  -> jwt.InvalidAlgorithmError
- firma invalida          -> jwt.InvalidSignatureError
- token expirado          -> jwt.ExpiredSignatureError
Las cuatro son subclases de jwt.InvalidTokenError.
"""
from datetime import timedelta
from uuid import uuid4

import jwt
import pytest

from app.core.config.settings import settings
from app.modules.auth.security.jwt_handler import JWTHandler

_SECRET = settings.security.secret_key.get_secret_value()
_ALGORITHM = settings.security.algorithm


def _decode_raw(token: str) -> dict:
    """Decodifica sin pasar por TokenPayload, para inspeccionar los
    claims tal cual viajan en el JWT."""
    return jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])


def test_create_and_decode_access_token_roundtrip():
    subject = uuid4()

    token = JWTHandler.create_access_token(subject)
    payload = JWTHandler.decode_token(token)

    assert payload.sub == subject
    assert payload.type == "access"


def test_create_and_decode_refresh_token_roundtrip():
    subject = uuid4()

    token = JWTHandler.create_refresh_token(subject)
    payload = JWTHandler.decode_token(token)

    assert payload.sub == subject
    assert payload.type == "refresh"


def test_decoded_payload_contains_all_expected_claims():
    subject = uuid4()

    token = JWTHandler.create_access_token(subject)
    payload = JWTHandler.decode_token(token)

    assert payload.sub == subject
    assert payload.jti is not None
    assert payload.type == "access"
    assert payload.iat is not None
    assert payload.exp is not None
    assert payload.exp > payload.iat


def test_access_token_expiry_matches_configured_minutes():
    token = JWTHandler.create_access_token(uuid4())
    payload = JWTHandler.decode_token(token)

    expected_seconds = settings.security.access_token_expire_minutes * 60
    actual_seconds = (payload.exp - payload.iat).total_seconds()

    assert actual_seconds == pytest.approx(expected_seconds, abs=2)


def test_refresh_token_expiry_matches_configured_days():
    token = JWTHandler.create_refresh_token(uuid4())
    payload = JWTHandler.decode_token(token)

    expected_seconds = settings.security.refresh_token_expire_days * 86400
    actual_seconds = (payload.exp - payload.iat).total_seconds()

    assert actual_seconds == pytest.approx(expected_seconds, abs=2)


def test_expired_token_raises_expired_signature_error():
    # Genera un token ya vencido de forma instantanea, sin sleep():
    # se llama directamente a _create_token con un expires_delta negativo.
    token = JWTHandler._create_token(
        uuid4(), token_type="access", expires_delta=timedelta(seconds=-1)
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        JWTHandler.decode_token(token)


def test_invalid_signature_raises():
    subject = uuid4()
    now_payload = jwt.decode(
        JWTHandler.create_access_token(subject),
        _SECRET,
        algorithms=[_ALGORITHM],
    )
    token_signed_with_wrong_secret = jwt.encode(
        now_payload, "a-completely-different-secret-key", algorithm=_ALGORITHM
    )

    with pytest.raises(jwt.InvalidSignatureError):
        JWTHandler.decode_token(token_signed_with_wrong_secret)


def test_invalid_algorithm_raises():
    subject = uuid4()
    raw_payload = jwt.decode(
        JWTHandler.create_access_token(subject),
        _SECRET,
        algorithms=[_ALGORITHM],
    )
    # Mismo secret, pero firmado con un algoritmo distinto al configurado
    # (HS256) -- decode_token solo acepta [settings.security.algorithm].
    token_wrong_algorithm = jwt.encode(raw_payload, _SECRET, algorithm="HS512")

    with pytest.raises(jwt.InvalidAlgorithmError):
        JWTHandler.decode_token(token_wrong_algorithm)


def test_missing_required_claim_raises():
    # Payload valido salvo que le falta "jti" por completo (no es que
    # valga None -- la clave no existe).
    incomplete_payload = jwt.decode(
        JWTHandler.create_access_token(uuid4()), _SECRET, algorithms=[_ALGORITHM]
    )
    del incomplete_payload["jti"]
    token_missing_jti = jwt.encode(incomplete_payload, _SECRET, algorithm=_ALGORITHM)

    with pytest.raises(jwt.MissingRequiredClaimError):
        JWTHandler.decode_token(token_missing_jti)


def test_malformed_claims_raise_invalid_token_error():
    # Todos los claims requeridos estan presentes (asi que PyJWT no
    # rechaza el token por si solo), pero "sub" no es un UUID valido --
    # eso lo debe atrapar la validacion de TokenPayload dentro de
    # decode_token(), que relanza como jwt.InvalidTokenError.
    payload = jwt.decode(
        JWTHandler.create_access_token(uuid4()), _SECRET, algorithms=[_ALGORITHM]
    )
    payload["sub"] = "this-is-not-a-valid-uuid"
    token_malformed_sub = jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)

    with pytest.raises(jwt.InvalidTokenError):
        JWTHandler.decode_token(token_malformed_sub)


def test_decode_token_does_not_enforce_expected_type():
    # JWTHandler.decode_token() es mecanica pura: no valida si "type" es
    # "access" o "refresh", ni ningun otro valor esperado. Esa
    # verificacion vive un nivel arriba (dependencies.get_current_user
    # compara payload.type != "access"; AuthService.refresh_token compara
    # payload.type != "refresh"). Este test documenta esa frontera de
    # responsabilidad -- no es un bug, es el diseño real.
    token = JWTHandler._create_token(
        uuid4(), token_type="not-a-real-type", expires_delta=timedelta(minutes=5)
    )

    payload = JWTHandler.decode_token(token)

    assert payload.type == "not-a-real-type"


def test_roles_and_permissions_never_travel_inside_the_token():
    token = JWTHandler.create_access_token(uuid4())

    raw_claims = _decode_raw(token)

    assert set(raw_claims.keys()) == {"sub", "iat", "exp", "type", "jti"}
    for forbidden in ("role", "roles", "permission", "permissions", "scope", "scopes"):
        assert forbidden not in raw_claims
