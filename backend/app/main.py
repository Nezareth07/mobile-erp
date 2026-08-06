from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import (
    AppException,
    BadRequestException,
    ConflictException,
    NotFoundException,
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

app = FastAPI(
    title="MobileERP API",
    version="0.1.0"
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

app.include_router(product_router)
app.include_router(brand_router)
app.include_router(category_router)
app.include_router(inventory_router)
app.include_router(supplier_router)
app.include_router(purchase_router)