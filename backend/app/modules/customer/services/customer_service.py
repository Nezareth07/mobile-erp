from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.modules.customer.models.customer import Customer
from app.modules.customer.repositories.customer_repository import (
    CustomerRepository,
)
from app.modules.customer.schemas.customer_create import CustomerCreate
from app.modules.customer.schemas.customer_update import CustomerUpdate


class CustomerService:
    def __init__(
        self,
        session: AsyncSession,
    ):
        self.session = session
        self.repository = CustomerRepository(session)

    async def get_customer(
        self,
        customer_id: UUID,
    ) -> Customer:
        customer = await self.repository.get_by_id(customer_id)

        if customer is None:
            raise NotFoundException("Customer not found.")

        return customer

    async def get_customers(
        self,
    ) -> list[Customer]:
        return await self.repository.get_active()

    async def create_customer(
        self,
        data: CustomerCreate,
    ) -> Customer:

        if data.document_id and await self.repository.document_id_exists(
            data.document_id
        ):
            raise ConflictException("Document ID already registered.")

        customer = Customer(
            name=data.name,
            document_id=data.document_id,
            phone=data.phone,
            email=data.email,
            address=data.address,
            notes=data.notes,
        )

        await self.repository.create(customer)

        await self.session.commit()

        await self.session.refresh(customer)

        return customer

    async def update_customer(
        self,
        customer_id: UUID,
        data: CustomerUpdate,
    ) -> Customer:

        customer = await self.get_customer(customer_id)

        if (
            data.document_id
            and data.document_id != customer.document_id
            and await self.repository.document_id_exists(data.document_id)
        ):
            raise ConflictException("Document ID already registered.")

        if data.name is not None:
            customer.name = data.name

        if data.document_id is not None:
            customer.document_id = data.document_id

        if data.phone is not None:
            customer.phone = data.phone

        if data.email is not None:
            customer.email = data.email

        if data.address is not None:
            customer.address = data.address

        if data.notes is not None:
            customer.notes = data.notes

        await self.session.commit()

        await self.session.refresh(customer)

        return customer

    async def delete_customer(
        self,
        customer_id: UUID,
    ) -> None:

        customer = await self.get_customer(customer_id)

        customer.is_active = False

        await self.session.commit()

    async def set_default_customer(
        self,
        customer_id: UUID,
    ) -> Customer:

        customer = await self.get_customer(customer_id)

        if not customer.is_active:
            raise BadRequestException("Customer is not active.")

        if customer.is_default_customer:
            return customer

        current_default = await self.repository.get_default()

        if current_default is not None and current_default.id != customer.id:
            current_default.is_default_customer = False

            await self.session.flush()

        customer.is_default_customer = True

        await self.session.commit()

        await self.session.refresh(customer)

        return customer
