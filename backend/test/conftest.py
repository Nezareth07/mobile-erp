"""Configuracion raiz de pytest.

CRITICO: las variables de entorno se fijan aqui, ANTES de cualquier
`import app...` (en este archivo o en cualquier otro que pytest cargue
despues). `app.core.config.settings.settings` es un singleton construido
al importar el modulo; si algo importara `app.*` antes de que estas lineas
corran, los tests apuntarian silenciosamente a la base de desarrollo.

Base de datos de pruebas: exclusivamente `mobileerp_test`, nunca
`mobileerp`. No se usa Base.metadata.create_all() -- el esquema se crea
corriendo las migraciones reales de Alembic (ver fixture
`apply_migrations`), porque son las migraciones (no los modelos) las que
siembran los 28 permisos y el rol ADMIN.
"""
import os

os.environ["DATABASE__URL"] = (
    "postgresql+asyncpg://postgres:postgres@localhost:5433/mobileerp_test"
)
os.environ["DATABASE__ECHO"] = "false"
os.environ["SECURITY__SECRET_KEY"] = (
    "test-only-secret-key-never-used-outside-pytest-0000000000"
)
os.environ["APPLICATION__ENVIRONMENT"] = "testing"

import subprocess  # noqa: E402
import sys  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402

_BACKEND_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def apply_migrations():
    """Corre `alembic upgrade head` una vez por sesion de pytest, contra
    mobileerp_test (settings.database.url ya apunta ahi por las variables
    de entorno fijadas arriba, heredadas por el subproceso)."""
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(_BACKEND_DIR),
        check=True,
    )
    yield


@pytest_asyncio.fixture
async def db_session(apply_migrations):
    """Sesion aislada por test: abre una transaccion real de Postgres y
    une la Session a ella en modo `create_savepoint` -- cuando el codigo
    de aplicacion (los Services) llama a session.commit(), SQLAlchemy lo
    traduce en liberar el SAVEPOINT actual y abrir uno nuevo de inmediato,
    sin tocar la transaccion externa. Esa transaccion externa nunca se
    comitea, solo se revierte al final del test. Ningun Service, Router
    ni Repository fue tocado para lograr esto -- se resuelve enteramente
    aqui, sobreescribiendo get_session via dependency_overrides."""
    from app.core.database.engine import engine
    from app.core.database.session import get_session
    from app.main import app

    async with engine.connect() as connection:
        await connection.begin()

        session_factory = async_sessionmaker(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        session = session_factory()

        async def override_get_session():
            yield session

        app.dependency_overrides[get_session] = override_get_session

        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_session, None)
            await session.close()
            await connection.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    """Cliente HTTP para tests aislados (CRUD, autorizacion, reglas de
    negocio de una sola operacion) -- usa la sesion revertida al final."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def live_client(apply_migrations):
    """Cliente HTTP SIN override de sesion -- cada request abre su propia
    AsyncSession real, exactamente como en produccion. Exclusivo para
    tests de concurrencia real; cada test que lo use es responsable de
    limpiar explicitamente (por id) los datos que haya creado."""
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
