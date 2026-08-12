"""Helpers minimos de creacion para tests. Deliberadamente NO es un
framework de factories: son funciones simples que llaman al Service real
de cada modulo (nunca insertan filas a mano), para que cada test siga
ejercitando las mismas reglas de negocio que la app usa en produccion.

Cada funcion recibe la AsyncSession del test (normalmente `db_session`)
y devuelve el modelo creado.
"""
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models.role import Role
from app.modules.auth.models.user import User
from app.modules.auth.repositories.permission_repository import (
    PermissionRepository,
)
from app.modules.auth.schemas.role_create import RoleCreate
from app.modules.auth.schemas.role_permission_assignment import (
    RolePermissionAssignment,
)
from app.modules.auth.schemas.user_create import UserCreate
from app.modules.auth.services.role_service import RoleService
from app.modules.auth.services.user_service import UserService
from app.modules.customer.models.customer import Customer
from app.modules.customer.schemas.customer_create import CustomerCreate
from app.modules.customer.services.customer_service import CustomerService
from app.modules.product.enums.tracking_type import TrackingType
from app.modules.product.models.brand import Brand
from app.modules.product.models.category import Category
from app.modules.product.models.product import Product
from app.modules.product.schemas.brand_create import BrandCreate
from app.modules.product.schemas.category_create import CategoryCreate
from app.modules.product.schemas.product_create import ProductCreate
from app.modules.product.services.brand_service import BrandService
from app.modules.product.services.category_service import CategoryService
from app.modules.product.services.product_service import ProductService
from app.modules.supplier.models.supplier import Supplier
from app.modules.supplier.schemas.supplier_create import SupplierCreate
from app.modules.supplier.services.supplier_service import SupplierService

DEFAULT_TEST_PASSWORD = "Sup3rSecretQA!"


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


async def create_brand(session: AsyncSession, name: str | None = None) -> Brand:
    service = BrandService(session)
    return await service.create_brand(BrandCreate(name=name or _unique("Brand")))


async def create_category(
    session: AsyncSession, name: str | None = None
) -> Category:
    service = CategoryService(session)
    return await service.create_category(
        CategoryCreate(name=name or _unique("Category"))
    )


async def create_product(
    session: AsyncSession,
    brand_id=None,
    category_id=None,
    sku: str | None = None,
    tracking_type: TrackingType = TrackingType.NONE,
    cost_price: Decimal = Decimal("10.00"),
    sale_price: Decimal = Decimal("20.00"),
) -> Product:
    if brand_id is None:
        brand_id = (await create_brand(session)).id
    if category_id is None:
        category_id = (await create_category(session)).id

    service = ProductService(session)
    return await service.create_product(
        ProductCreate(
            name=_unique("Product"),
            sku=sku or _unique("SKU"),
            brand_id=brand_id,
            category_id=category_id,
            tracking_type=tracking_type,
            cost_price=cost_price,
            sale_price=sale_price,
        )
    )


async def create_supplier(
    session: AsyncSession, name: str | None = None
) -> Supplier:
    service = SupplierService(session)
    return await service.create_supplier(
        SupplierCreate(name=name or _unique("Supplier"))
    )


async def create_customer(
    session: AsyncSession, name: str | None = None
) -> Customer:
    service = CustomerService(session)
    return await service.create_customer(
        CustomerCreate(name=name or _unique("Customer"))
    )


async def create_role(
    session: AsyncSession,
    name: str | None = None,
    description: str | None = None,
) -> Role:
    service = RoleService(session)
    return await service.create_role(
        RoleCreate(name=name or _unique("ROLE"), description=description)
    )


async def create_user(
    session: AsyncSession,
    role_ids: list | None = None,
    email: str | None = None,
    password: str = DEFAULT_TEST_PASSWORD,
) -> User:
    service = UserService(session)
    return await service.create_user(
        UserCreate(
            email=email or f"{_unique('user')}@mobileerp-test.dev",
            full_name="Test User",
            password=password,
            role_ids=role_ids or [],
        )
    )


async def create_role_with_permission(
    session: AsyncSession,
    permission_code: str,
    name: str | None = None,
) -> Role:
    """Crea un rol y le asigna un unico permiso ya sembrado por las
    migraciones, via RoleService.assign_permissions -- nunca inserta la
    relacion rol-permiso a mano."""
    role = await create_role(session, name=name)

    permission = await PermissionRepository(session).get_by_code(
        permission_code
    )

    if permission is None:
        raise ValueError(
            f"Permission '{permission_code}' is not seeded in the test DB."
        )

    service = RoleService(session)
    return await service.assign_permissions(
        role.id,
        RolePermissionAssignment(permission_ids=[permission.id]),
    )


async def create_admin(
    session: AsyncSession,
    email: str | None = None,
    password: str = DEFAULT_TEST_PASSWORD,
) -> User:
    """Crea (o reutiliza, si ya existe uno activo) un usuario ADMIN via
    UserService.bootstrap_admin -- el mismo camino que usa el CLI real,
    nunca un subprocess."""
    service = UserService(session)
    user, _created = await service.bootstrap_admin(
        email=email or f"{_unique('admin')}@mobileerp-test.dev",
        full_name="Test Admin",
        password=password,
    )
    return user
