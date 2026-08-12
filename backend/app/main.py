from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.config.settings import settings
from app.core.exceptions import (
    AppException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.modules.product.routers.product_router import router as product_router
from app.modules.product.routers.brand_router import router as brand_router

from app.modules.product.routers.category_router import (
    router as category_router,
)
from app.modules.inventory.routers.inventory_router import (
    router as inventory_router,
)
from app.modules.supplier.routers.supplier_router import (
    router as supplier_router,
)
from app.modules.purchase.routers.purchase_router import (
    router as purchase_router,
)
from app.modules.customer.routers.customer_router import (
    router as customer_router,
)
from app.modules.sale.routers.sale_router import (
    router as sale_router,
)
from app.modules.auth.routers.auth_router import (
    router as auth_router,
)
from app.modules.auth.routers.user_router import (
    router as user_router,
)
from app.modules.auth.routers.role_router import (
    router as role_router,
)
from app.modules.auth.routers.permission_router import (
    router as permission_router,
)
from app.modules.dashboard.routers.dashboard_router import (
    router as dashboard_router,
)
from app.modules.report.routers.report_router import (
    router as report_router,
)

app = FastAPI(
    title="MobileERP API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_error_response(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": message})


@app.exception_handler(NotFoundException)
async def not_found_exception_handler(_: Request, exc: NotFoundException):
    return _build_error_response(404, str(exc))


@app.exception_handler(ConflictException)
async def conflict_exception_handler(_: Request, exc: ConflictException):
    return _build_error_response(409, str(exc))


@app.exception_handler(BadRequestException)
async def bad_request_exception_handler(_: Request, exc: BadRequestException):
    return _build_error_response(400, str(exc))


@app.exception_handler(UnauthorizedException)
async def unauthorized_exception_handler(_: Request, exc: UnauthorizedException):
    return _build_error_response(401, str(exc))


@app.exception_handler(ForbiddenException)
async def forbidden_exception_handler(_: Request, exc: ForbiddenException):
    return _build_error_response(403, str(exc))


@app.exception_handler(AppException)
async def app_exception_handler(_: Request, exc: AppException):
    return _build_error_response(400, str(exc))


@app.exception_handler(IntegrityError)
async def integrity_error_handler(_: Request, exc: IntegrityError):
    return _build_error_response(
        409, "The request conflicts with existing data."
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}

api_router = APIRouter(prefix=settings.api.prefix)

api_router.include_router(product_router)
api_router.include_router(brand_router)
api_router.include_router(category_router)
api_router.include_router(inventory_router)
api_router.include_router(supplier_router)
api_router.include_router(purchase_router)
api_router.include_router(customer_router)
api_router.include_router(sale_router)
api_router.include_router(auth_router)
api_router.include_router(user_router)
api_router.include_router(role_router)
api_router.include_router(permission_router)
api_router.include_router(dashboard_router)
api_router.include_router(report_router)

app.include_router(api_router)