from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_permission_service, require_role
from app.modules.auth.schemas.permission_response import PermissionResponse
from app.modules.auth.services.permission_service import PermissionService

router = APIRouter(
    prefix="/permissions",
    tags=["Permissions"],
)


@router.get(
    "",
    response_model=list[PermissionResponse],
    dependencies=[Depends(require_role("ADMIN"))],
)
async def get_permissions(
    service: PermissionService = Depends(get_permission_service),
):
    return await service.get_permissions()
