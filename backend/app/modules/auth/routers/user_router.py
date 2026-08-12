from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.exceptions import ForbiddenException
from app.modules.auth.dependencies import (
    get_current_user,
    get_user_service,
    require_role,
)
from app.modules.auth.models.user import User
from app.modules.auth.schemas.user_create import UserCreate
from app.modules.auth.schemas.user_password_change import UserPasswordChange
from app.modules.auth.schemas.user_response import UserResponse
from app.modules.auth.schemas.user_role_assignment import UserRoleAssignment
from app.modules.auth.schemas.user_update import UserUpdate
from app.modules.auth.services.user_service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

_FORBIDDEN_PASSWORD_MESSAGE = "You can only change your own password."


@router.post(
    "",
    response_model=UserResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def create_user(
    data: UserCreate,
    service: UserService = Depends(get_user_service),
):
    return await service.create_user(data)


@router.get(
    "",
    response_model=list[UserResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def get_users(
    service: UserService = Depends(get_user_service),
):
    return await service.get_users()


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def get_user(
    user_id: UUID,
    service: UserService = Depends(get_user_service),
):
    return await service.get_user(user_id)


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_user(
    user_id: UUID,
    data: UserUpdate,
    service: UserService = Depends(get_user_service),
):
    return await service.update_user(user_id, data)


@router.delete(
    "/{user_id}",
    status_code=204,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def deactivate_user(
    user_id: UUID,
    service: UserService = Depends(get_user_service),
):
    await service.deactivate_user(user_id)


@router.put(
    "/{user_id}/roles",
    response_model=UserResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def assign_roles(
    user_id: UUID,
    data: UserRoleAssignment,
    service: UserService = Depends(get_user_service),
):
    return await service.assign_roles(user_id, data)


@router.put(
    "/{user_id}/password",
    status_code=204,
)
async def change_password(
    user_id: UUID,
    data: UserPasswordChange,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    if user_id != current_user.id:
        raise ForbiddenException(_FORBIDDEN_PASSWORD_MESSAGE)

    await service.change_password(user_id, data)
