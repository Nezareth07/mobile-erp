"""Prueba fundacional de la suite: confirma que el patron
transaccion-externa + SAVEPOINT (conftest.db_session) realmente aisla
cada test, incluso cuando el codigo de aplicacion llama a
session.commit() directamente (como hace BrandService, sin modificar).

Dos tests separados, deliberadamente: el primero crea y comitea (via el
Service real) una marca con un nombre fijo; el segundo, en una sesion
nueva con su propia transaccion, prueba que esa marca NO existe. Si el
aislamiento estuviera roto, el segundo test la encontraria.
"""
from sqlalchemy import select

from app.modules.product.models.brand import Brand
from app.modules.product.schemas.brand_create import BrandCreate
from app.modules.product.services.brand_service import BrandService

_BRAND_NAME = "QA Isolation Marker Brand"


async def test_step_1_create_and_commit_a_brand(db_session):
    service = BrandService(db_session)

    brand = await service.create_brand(BrandCreate(name=_BRAND_NAME))

    assert brand.id is not None
    assert brand.name == _BRAND_NAME

    # confirma que, DENTRO de este mismo test, la marca es visible via
    # una consulta fresca -- prueba que el commit() de verdad escribio
    # algo (dentro del SAVEPOINT), no que simplemente no fallo.
    result = await db_session.execute(
        select(Brand).where(Brand.name == _BRAND_NAME)
    )
    assert result.scalar_one_or_none() is not None


async def test_step_2_previous_brand_must_not_leak_into_this_test(db_session):
    result = await db_session.execute(
        select(Brand).where(Brand.name == _BRAND_NAME)
    )
    leaked = result.scalar_one_or_none()

    assert leaked is None, (
        "La marca creada en el test anterior SIGUE existiendo -- el "
        "aislamiento por SAVEPOINT esta roto."
    )
