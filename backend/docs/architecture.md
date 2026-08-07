# Arquitectura — MobileERP Backend

Este documento describe la arquitectura técnica del backend tal como existe hoy: stack, capas, patrones y el flujo real de una petición HTTP. No describe funcionalidad de negocio (ver `domain-model.md`) ni procesos transaccionales específicos (ver `transaction-flow.md`).

## Stack tecnológico

| Componente | Tecnología | Notas |
|---|---|---|
| Framework HTTP | FastAPI | Una sola instancia `FastAPI()` en `app/main.py`, sin app factory. |
| ORM | SQLAlchemy 2.0 (estilo `Mapped`/`mapped_column`), modo **async** | `sqlalchemy[asyncio]` + `asyncpg` como driver. |
| Base de datos | PostgreSQL 17 | Corre en Docker (ver más abajo). |
| Migraciones | Alembic | Migraciones escritas a partir de `--autogenerate` y ajustadas a mano. |
| Validación / Schemas | Pydantic v2 | Todos los schemas usan `model_config = ConfigDict(from_attributes=True)`. |
| Configuración | `pydantic-settings` | `Settings` lee `.env` con delimitador de anidación `__` (p. ej. `DATABASE__URL`). |
| Servidor ASGI | Uvicorn | `uvicorn app.main:app`. |
| Contenedores | Docker Compose | **Solo para PostgreSQL** — no existe `Dockerfile` para la API; el backend corre localmente con Uvicorn. |

`docker-compose.yml` (raíz del repo) levanta un único servicio `postgres:17` en el puerto `5433`, con healthcheck y volumen nombrado (`postgres_data`). La API se ejecuta fuera de Docker, apuntando a esa base vía `DATABASE__URL=postgresql+asyncpg://...@localhost:5433/mobileerp`.

## Arquitectura en capas

El backend sigue una arquitectura en capas estricta, replicada de forma idéntica en cada módulo de negocio:

```
Router  →  Service  →  Repository  →  Model (SQLAlchemy) → PostgreSQL
  │           │             │
  │           │             └─ Acceso a datos puro (queries), sin reglas de negocio
  │           └─ Reglas de negocio, validaciones, orquestación, límites de transacción
  └─ HTTP: recibe/valida el request (vía Pydantic), delega, serializa la respuesta
```

Cada módulo de negocio (`app/modules/<modulo>/`) replica esta misma estructura de carpetas:

```
app/modules/<modulo>/
├── __init__.py
├── dependencies.py        # provee el Service vía Depends() de FastAPI
├── models/                 # entidades SQLAlchemy (tablas)
├── schemas/                 # Pydantic: <Entidad>Create / Update / Response / Summary
├── repositories/             # acceso a datos, extiende BaseRepository[Model]
├── services/                 # reglas de negocio y orquestación transaccional
├── routers/                   # endpoints FastAPI
└── enums/                      # (cuando aplica) enums Python (str, Enum)
```

### Responsabilidades de cada capa

**Router** (`routers/*.py`)
- Define los endpoints (`APIRouter(prefix=..., tags=[...])`).
- Recibe el request ya validado por Pydantic (`data: XCreate`).
- Obtiene el Service vía `Depends(get_x_service)`.
- Llama exactamente un método del Service y devuelve su resultado (FastAPI lo serializa con `response_model`).
- No contiene lógica de negocio ni acceso a datos.

**Service** (`services/*.py`)
- Contiene toda la lógica de negocio: validaciones, reglas de dominio, orquestación entre varias entidades/repositorios.
- Es dueño de los límites de transacción (ver convención de commit/flush más abajo y en `transaction-flow.md`).
- Traduce condiciones de negocio inválidas en excepciones tipadas (`NotFoundException`, `ConflictException`, `BadRequestException`).
- Construye sus propios repositorios en el `__init__` a partir de la misma `AsyncSession` que recibe.

**Repository** (`repositories/*.py`)
- Encapsula el acceso a datos: `select`, `with_for_update`, `selectinload` para precarga de relaciones.
- Extiende `BaseRepository[ModelType]` (`app/core/repositories/base_repository.py`), que provee `get_by_id`, `get_all`, `create` (solo `session.add`, sin flush) y `delete`.
- No contiene reglas de negocio ni valida nada — solo construye y ejecuta queries.
- No hace `commit()` ni `flush()` por su cuenta (eso lo decide el Service que lo usa).

**Model** (`models/*.py`)
- Clases SQLAlchemy declarativas (`class X(UUIDMixin, TimestampMixin, Base)`).
- Definen columnas, `CheckConstraint`s y relaciones (`relationship()`), usando *forward refs* en string (`Mapped["OtraClase"]`) sin necesidad de importar la clase referenciada — todos los modelos se registran sobre el mismo `Base.metadata` al arrancar la app / correr Alembic.

## Repository Pattern

`app/core/repositories/base_repository.py` define un repositorio genérico parametrizado por tipo de modelo:

```python
class BaseRepository(Generic[ModelType]):
    def __init__(self, session: AsyncSession, model: type[ModelType]): ...
    async def get_by_id(self, id: uuid.UUID) -> ModelType | None: ...
    async def get_all(self) -> list[ModelType]: ...
    async def create(self, entity: ModelType) -> ModelType: ...  # solo session.add()
    async def delete(self, entity: ModelType) -> None: ...
```

Cada repositorio de módulo (`SupplierRepository`, `ProductRepository`, `SaleRepository`, etc.) hereda de `BaseRepository[X]` y agrega métodos específicos del dominio: búsquedas por campo único (`get_by_sku`, `get_by_imei`), chequeos de existencia (`sku_exists`, `document_id_exists`), listados filtrados (`get_active`, `list_by_product`), agregaciones (`count_available_by_product`, `sum_available_by_product`) y, cuando la concurrencia importa, lecturas con bloqueo de fila (`get_for_update`, vía `with_for_update()`).

Algunos repositorios sobreescriben `get_by_id` para precargar relaciones con `selectinload` (p. ej. `PurchaseRepository.get_by_id` precarga `supplier`, `location` y `lines.product`) — necesario porque los `Response` schemas anidan esas relaciones y SQLAlchemy async no permite lazy-loading implícito fuera de una sesión activa.

## Service Layer

Cada Service:
1. Recibe una `AsyncSession` en el constructor (nunca la crea él mismo).
2. Construye sus propios repositorios sobre esa misma sesión.
3. Expone métodos de caso de uso (`create_x`, `get_x`, `update_x`, `delete_x`) que devuelven modelos de SQLAlchemy (no schemas — la conversión a `Response` la hace FastAPI vía `response_model`).
4. Traduce reglas de negocio violadas en excepciones (`app/core/exceptions.py`).

Dos convenciones transaccionales conviven, según la complejidad del caso de uso (documentado en detalle en `transaction-flow.md`):

- **Servicios de escritura simple** (`SupplierService`, `ProductService`, `CustomerService`, Brand/Category): cada método de escritura hace su propio `commit()` — no hay más de una entidad involucrada por operación.
- **Servicios orquestadores** (`PurchaseService`, `SaleService`): el caso de uso completo toca varias entidades y otro servicio (`InventoryService`). Internamente solo usan `flush()` (para obtener IDs generados antes de continuar) y hacen **un único `commit()`** al final del método, garantizando atomicidad de todo el proceso.
- `InventoryService` es un caso especial: **nunca hace `commit()`**, solo `flush()`, porque siempre es invocado desde otro Service (Purchase, Sale) o desde el propio Router (`inventory_router.py`, que hace `session.commit()` explícito tras llamar al servicio) — nunca es dueño de su propia transacción.

**Regla de encapsulamiento entre servicios**: un Service puede usar directamente el Repository de otra entidad "simple" para lecturas de validación (p. ej. `PurchaseService` y `SaleService` usan `ProductRepository`/`SupplierRepository`/`CustomerRepository` directamente). Pero ningún Service accede a los repositorios internos de `InventoryService` (`ProductUnitRepository`, `StockLotRepository`, `StockMovementRepository`) — toda modificación de inventario pasa exclusivamente por los métodos públicos de `InventoryService`. Esta regla se estableció explícitamente durante la revisión del módulo Purchase y se mantuvo en Sale.

## Dependency Injection

FastAPI resuelve las dependencias vía `Depends()`. El patrón estándar (usado por Supplier, Inventory, Purchase, Customer y Sale) es un `dependencies.py` por módulo:

```python
# app/modules/<modulo>/dependencies.py
def get_x_service(session: AsyncSession = Depends(get_session)) -> XService:
    return XService(session)
```

y en el router:

```python
async def endpoint(..., service: XService = Depends(get_x_service)):
    return await service.metodo(...)
```

`get_session` (`app/core/database/session.py`) es la dependencia raíz: abre una `AsyncSession` por request vía `async_sessionmaker` y la cierra al finalizar (`async with SessionFactory() as session: yield session`).

> **Nota de consistencia**: el módulo `product` (el más antiguo del proyecto) no sigue este patrón — sus routers instancian `ProductService(session)` directamente dentro de cada endpoint, con `session: AsyncSession = Depends(get_session)` inyectada de forma directa, en vez de un `get_product_service` en `dependencies.py`. Funcionalmente es equivalente, pero es una inconsistencia real frente a la convención que se consolidó después. Se documenta aquí tal como está, sin corregirla (no se pidió refactorizar).

## SQLAlchemy Async

- `app/core/database/engine.py`: `create_async_engine(url=settings.database.url, echo=settings.database.echo, pool_pre_ping=True)`.
- `app/core/database/session.py`: `async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)`. `expire_on_commit=False` es deliberado: permite seguir leyendo atributos de un objeto justo después de un `commit()` (p. ej. devolver el objeto recién creado en la respuesta) sin disparar un refresh/lazy-load implícito.
- `app/core/database/base.py`: `Base` declarativo con una `naming_convention` explícita para índices/constraints (`ix_`, `uq_`, `ck_`, `fk_`, `pk_` + nombre de tabla/columna) — esto es lo que permite que Alembic genere nombres de constraint deterministas y reproducibles vía `op.f(...)`.
- Mixins compartidos (`app/core/database/mixins/`):
  - `UUIDMixin`: `id: Mapped[uuid.UUID]`, PK, `default=uuid.uuid4` (generado en Python, no en la base de datos).
  - `TimestampMixin`: `created_at`/`updated_at`, `DateTime(timezone=True)`, `server_default=func.now()` (`updated_at` además con `onupdate=func.now()`).
- Todas las queries son asíncronas (`await self.session.execute(...)`, `await self.session.get(...)`).

## Alembic

- `alembic/env.py` importa **explícitamente** cada modelo de cada módulo (con `# noqa: F401`) antes de exponer `target_metadata = Base.metadata` — es el mecanismo que registra todas las tablas para que `--autogenerate` las detecte. Cualquier modelo nuevo debe agregarse a esta lista de imports.
- Las migraciones se generan con `alembic revision --autogenerate -m "..."` contra la base de datos local y luego se revisan/ajustan a mano antes de aplicarlas — en particular, para eliminar ruido de otros módulos que `--autogenerate` pueda detectar como diferencia (ver drift conocido en `backend-roadmap.md`).
- Convención de nombre de archivo: `<revision_hash>_create_<modulo>_table(s).py` (singular si crea una sola tabla, plural si crea varias).
- `env.py` corre en modo async (`async_engine_from_config` + `connection.run_sync(do_run_migrations)`), usando la misma URL de configuración que la app (`settings.database.url`).

## Flujo de una petición HTTP

Ejemplo genérico, válido para cualquier endpoint de creación (`POST /suppliers`, `POST /purchases`, `POST /sales`, etc.):

```
1. Cliente HTTP → POST /recurso   (JSON body)
2. FastAPI valida el body contra el schema *Create (Pydantic)
   → si falla: 422 Unprocessable Entity (automático, antes de llegar al Router)
3. FastAPI resuelve Depends(get_x_service)
   → Depends(get_session) abre una AsyncSession nueva
   → XService(session) se construye, construye sus propios repositorios
4. Router.endpoint(data, service) llama a service.create_x(data)
5. Service:
   a. valida reglas de negocio (existencia, duplicados, estados) vía Repository(s)
      → si algo falla: raise NotFoundException / ConflictException / BadRequestException
   b. construye el/los modelo(s) SQLAlchemy
   c. Repository.create(entity)  → session.add(entity)
   d. flush()/commit() según el patrón del Service (ver arriba)
6. Si el Service lanzó una excepción tipada:
   → el exception_handler global correspondiente (app/main.py) la convierte en
     JSONResponse({"detail": str(exc)}) con el status code correcto (404/409/400)
   → si en cambio fue un IntegrityError de SQLAlchemy no capturado antes,
     el handler global de IntegrityError responde 409 genérico (red de seguridad)
7. Si todo salió bien: Service devuelve el modelo SQLAlchemy
8. FastAPI serializa el modelo contra el response_model (*Response schema)
   → gracias a from_attributes=True, Pydantic lee los atributos del objeto ORM directamente
9. Cliente HTTP ← 200/201 JSON (o 204 sin body para DELETE)
```

## Router → Service → Repository: interacción real

Dos formas de composición coexisten en el proyecto, según si el caso de uso involucra una sola entidad o varias:

**Caso simple** (Supplier, Customer, Product, Brand, Category — CRUD con reglas de negocio acotadas a una entidad):

```
Router → Service → Repository (propio) → DB
```

**Caso orquestado** (Purchase, Sale — un caso de uso que escribe en varias entidades y depende de otro módulo):

```
Router → Service → Repository (propio, para el header/líneas)
                 → InventoryService.metodo_publico(...) → sus propios repositorios → DB
```

En el caso orquestado, el Service "dueño" del caso de uso (`PurchaseService`, `SaleService`) nunca importa los repositorios internos de `InventoryService` — solo llama a sus métodos públicos (`register_serial_intake`, `register_batch_sale`, `resolve_location`, `get_available_stock`, etc.), pasándole un schema de entrada (`SerialIntakeCreate`, `BatchSaleCreate`, ...) y recibiendo de vuelta el modelo resultante. Esto mantiene a `InventoryService` como el único punto de modificación del stock (`ProductUnit`, `StockLot`, `StockMovement`), sin importar desde qué módulo se origine la operación.
