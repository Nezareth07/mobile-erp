from uuid import UUID

import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedException
from app.modules.auth.repositories.user_repository import UserRepository
from app.modules.auth.schemas.login_request import LoginRequest
from app.modules.auth.schemas.refresh_request import RefreshRequest
from app.modules.auth.schemas.token_response import TokenResponse
from app.modules.auth.security.dummy_hash import DUMMY_PASSWORD_HASH
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.auth.security.password_hasher import PasswordHasher
from app.core.config.settings import settings

_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password."
_INVALID_REFRESH_TOKEN_MESSAGE = "Invalid or expired refresh token."


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = UserRepository(session)

    async def login(
        self,
        data: LoginRequest,
    ) -> TokenResponse:

        user = await self.repository.get_by_email(data.email)

        hash_to_verify = user.password_hash if user else DUMMY_PASSWORD_HASH

        password_valid = PasswordHasher.verify(
            data.password,
            hash_to_verify,
        )

        if user is None or not password_valid or not user.is_active:
            raise UnauthorizedException(_INVALID_CREDENTIALS_MESSAGE)

        return self._issue_tokens(user.id)

    async def refresh(
        self,
        data: RefreshRequest,
    ) -> TokenResponse:

        try:
            payload = JWTHandler.decode_token(data.refresh_token)
        except jwt.InvalidTokenError:
            raise UnauthorizedException(_INVALID_REFRESH_TOKEN_MESSAGE)

        if payload.type != "refresh":
            raise UnauthorizedException(_INVALID_REFRESH_TOKEN_MESSAGE)

        user = await self.repository.get_by_id(payload.sub)

        if user is None or not user.is_active:
            raise UnauthorizedException(_INVALID_REFRESH_TOKEN_MESSAGE)

        return self._issue_tokens(user.id)

    def _issue_tokens(
        self,
        user_id: UUID,
    ) -> TokenResponse:

        access_token = JWTHandler.create_access_token(user_id)
        refresh_token = JWTHandler.create_refresh_token(user_id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.security.access_token_expire_minutes * 60,
        )
