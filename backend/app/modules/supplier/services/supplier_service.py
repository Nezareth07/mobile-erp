from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.modules.supplier.models.supplier import Supplier
from app.modules.supplier.repositories.supplier_repository import (
    SupplierRepository,
)
from app.modules.supplier.schemas.supplier_create import SupplierCreate
from app.modules.supplier.schemas.supplier_update import SupplierUpdate


class SupplierService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = SupplierRepository(session)

    async def get_supplier(
        self,
        supplier_id: UUID,
    ) -> Supplier:
        supplier = await self.repository.get_by_id(supplier_id)

        if supplier is None:
            raise NotFoundException("Supplier not found.")

        return supplier

    async def get_suppliers(
        self,
    ) -> list[Supplier]:
        return await self.repository.get_active()

    async def count_active_suppliers(
        self,
    ) -> int:
        return await self.repository.count_active()

    async def create_supplier(
        self,
        data: SupplierCreate,
    ) -> Supplier:

        if await self.repository.name_exists(data.name):
            raise ConflictException("Supplier already exists.")

        if data.tax_id and await self.repository.tax_id_exists(data.tax_id):
            raise ConflictException("Tax ID already registered.")

        supplier = Supplier(
            name=data.name,
            tax_id=data.tax_id,
            contact_name=data.contact_name,
            phone=data.phone,
            email=data.email,
            address=data.address,
            notes=data.notes,
        )

        await self.repository.create(supplier)

        await self.session.commit()

        await self.session.refresh(supplier)

        return supplier

    async def update_supplier(
        self,
        supplier_id: UUID,
        data: SupplierUpdate,
    ) -> Supplier:

        supplier = await self.get_supplier(supplier_id)

        if (
            data.name
            and data.name != supplier.name
            and await self.repository.name_exists(data.name)
        ):
            raise ConflictException("Supplier already exists.")

        if (
            data.tax_id
            and data.tax_id != supplier.tax_id
            and await self.repository.tax_id_exists(data.tax_id)
        ):
            raise ConflictException("Tax ID already registered.")

        if data.name is not None:
            supplier.name = data.name

        if data.tax_id is not None:
            supplier.tax_id = data.tax_id

        if data.contact_name is not None:
            supplier.contact_name = data.contact_name

        if data.phone is not None:
            supplier.phone = data.phone

        if data.email is not None:
            supplier.email = data.email

        if data.address is not None:
            supplier.address = data.address

        if data.notes is not None:
            supplier.notes = data.notes

        await self.session.commit()

        await self.session.refresh(supplier)

        return supplier

    async def delete_supplier(
        self,
        supplier_id: UUID,
    ) -> None:

        supplier = await self.get_supplier(supplier_id)

        supplier.is_active = False

        await self.session.commit()
