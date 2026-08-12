from uuid import UUID

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_role_service, require_role
from app.modules.auth.schemas.role_create import RoleCreate
from app.modules.auth.schemas.role_permission_assignment import (
    RolePermissionAssignment,
)
from app.modules.auth.schemas.role_response import RoleResponse
from app.modules.auth.schemas.role_update import RoleUpdate
from app.modules.auth.services.role_service import RoleService

router = APIRouter(
    prefix="/roles",
    tags=["Roles"],
)


@router.post(
    "",
    response_model=RoleResponse,
    status_code=201,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def create_role(
    data: RoleCreate,
    service: RoleService = Depends(get_role_service),
):
    return await service.create_role(data)


@router.get(
    "",
    response_model=list[RoleResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def get_roles(
    service: RoleService = Depends(get_role_service),
):
    return await service.get_roles()


@router.get(
    "/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def get_role(
    role_id: UUID,
    service: RoleService = Depends(get_role_service),
):
    return await service.get_role(role_id)


@router.put(
    "/{role_id}",
    response_model=RoleResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def update_role(
    role_id: UUID,
    data: RoleUpdate,
    service: RoleService = Depends(get_role_service),
):
    return await service.update_role(role_id, data)


@router.delete(
    "/{role_id}",
    status_code=204,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def deactivate_role(
    role_id: UUID,
    service: RoleService = Depends(get_role_service),
):
    await service.deactivate_role(role_id)


@router.put(
    "/{role_id}/permissions",
    response_model=RoleResponse,
    dependencies=[Depends(require_role("ADMIN"))],
)
async def assign_permissions(
    role_id: UUID,
    data: RolePermissionAssignment,
    service: RoleService = Depends(get_role_service),
):
    return await service.assign_permissions(role_id, data)
