import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database.session import get_session
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.modules.auth.models.user import User
from app.modules.auth.repositories.user_repository import UserRepository
from app.modules.auth.security.jwt_handler import JWTHandler
from app.modules.auth.services.auth_service import AuthService

_INVALID_CREDENTIALS_MESSAGE = "Could not validate credentials."
_FORBIDDEN_MESSAGE = "You do not have permission to perform this action."

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


def get_auth_service(
    session: AsyncSession = Depends(get_session),
) -> AuthService:
    return AuthService(session)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:

    if token is None:
        raise UnauthorizedException(_INVALID_CREDENTIALS_MESSAGE)

    try:
        payload = JWTHandler.decode_token(token)
    except jwt.InvalidTokenError:
        raise UnauthorizedException(_INVALID_CREDENTIALS_MESSAGE)

    if payload.type != "access":
        raise UnauthorizedException(_INVALID_CREDENTIALS_MESSAGE)

    repository = UserRepository(session)
    user = await repository.get_by_id(payload.sub)

    if user is None or not user.is_active:
        raise UnauthorizedException(_INVALID_CREDENTIALS_MESSAGE)

    return user


def require_role(role_name: str):
    async def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        active_role_names = {
            role.name for role in current_user.roles if role.is_active
        }

        if role_name not in active_role_names:
            raise ForbiddenException(_FORBIDDEN_MESSAGE)

        return current_user

    return dependency


def require_permission(permission_code: str):
    async def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        active_permission_codes = {
            permission.code
            for role in current_user.roles
            if role.is_active
            for permission in role.permissions
        }

        if permission_code not in active_permission_codes:
            raise ForbiddenException(_FORBIDDEN_MESSAGE)

        return current_user

    return dependency
