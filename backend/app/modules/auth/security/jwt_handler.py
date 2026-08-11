from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import jwt
from pydantic import ValidationError

from app.core.config.settings import settings
from app.modules.auth.schemas.token_payload import TokenPayload


class JWTHandler:
    """Mecanica pura de JWT — sin sesion, sin repositories, sin conocimiento de User/Role/Permission."""

    @staticmethod
    def create_access_token(subject: UUID) -> str:
        return JWTHandler._create_token(
            subject,
            token_type="access",
            expires_delta=timedelta(
                minutes=settings.security.access_token_expire_minutes
            ),
        )

    @staticmethod
    def create_refresh_token(subject: UUID) -> str:
        return JWTHandler._create_token(
            subject,
            token_type="refresh",
            expires_delta=timedelta(
                days=settings.security.refresh_token_expire_days
            ),
        )

    @staticmethod
    def _create_token(
        subject: UUID,
        token_type: str,
        expires_delta: timedelta,
    ) -> str:
        now = datetime.now(timezone.utc)

        payload = {
            "sub": str(subject),
            "iat": now,
            "exp": now + expires_delta,
            "type": token_type,
            "jti": str(uuid4()),
        }

        return jwt.encode(
            payload,
            settings.security.secret_key.get_secret_value(),
            algorithm=settings.security.algorithm,
        )

    @staticmethod
    def decode_token(token: str) -> TokenPayload:
        raw = jwt.decode(
            token,
            settings.security.secret_key.get_secret_value(),
            algorithms=[settings.security.algorithm],
            options={"require": ["sub", "exp", "iat", "type", "jti"]},
        )

        try:
            return TokenPayload(**raw)
        except ValidationError as exc:
            raise jwt.InvalidTokenError(
                "Token claims are malformed."
            ) from exc
