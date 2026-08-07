# Convenciones de la API — MobileERP Backend

Documenta las convenciones reales seguidas por el proyecto, extraídas del código existente. Cualquier módulo nuevo debe seguir estas mismas convenciones salvo que se decida explícitamente lo contrario.

## UUID

- Toda entidad usa UUID como clave primaria, nunca autoincremental.
- Se implementa vía `UUIDMixin` (`app/core/database/mixins/uuid.py`): `id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)`.
- El UUID se genera **en Python** (`default=uuid.uuid4`), no en la base de datos — está disponible inmediatamente después de instanciar el objeto, sin esperar un `flush()`. Aun así, el patrón establecido sigue siendo hacer `flush()` después de `create()` cuando otro paso del mismo método necesita referenciar ese id (por consistencia y porque el objeto debe estar persistido, no solo tener un id en memoria, antes de que una FK lo referencie).

## Soft Delete

- Aplica a entidades de catálogo/maestras: `Brand`, `Category`, `Product`, `Supplier`, `Customer`, `Location`. Todas tienen `is_active: bool` (default `True`).
- El endpoint `DELETE /{recurso}/{id}` nunca borra la fila — pone `is_active = False` y responde `204 No Content`.
- Una entidad inactiva:
  - **No** puede usarse en operaciones nuevas (una compra no puede referenciar un `Supplier`/`Product` inactivo; una venta no puede referenciar un `Customer`/`Product` inactivo).
  - **Sí** sigue siendo legible por `GET /{recurso}/{id}` — los endpoints de detalle nunca filtran por `is_active`, solo los de listado (`get_active()` en el repositorio) lo hacen. Esto es deliberado: los registros históricos (una compra o venta pasada) deben seguir siendo consultables aunque el proveedor/producto/cliente involucrado ya no esté activo.
- **Las entidades transaccionales no tienen soft delete**: `Purchase` y `Sale` no tienen `is_active` ni endpoint `DELETE`. Su ciclo de vida se modela con un campo `status` (`PurchaseStatus`/`SaleStatus`: `confirmed` \| `cancelled`) — hoy solo `CONFIRMED` tiene flujo implementado; la transición a `CANCELLED` está preparada en el enum pero sin endpoint ni lógica todavía.

## Repository Pattern

- Todo repositorio extiende `BaseRepository[ModelType]` (`app/core/repositories/base_repository.py`), que da `get_by_id`, `get_all`, `create` (solo `session.add`) y `delete`.
- Un repositorio **nunca** contiene reglas de negocio ni levanta excepciones de dominio — solo construye y ejecuta queries (`select`, `with_for_update`, `selectinload`, `func.count`/`func.sum`). La decisión de qué hacer con un resultado (p. ej. `None` → `NotFoundException`) es responsabilidad del Service.
- Un repositorio **nunca** hace `commit()` ni `flush()` por su cuenta — eso lo decide el Service que lo usa.
- Precarga de relaciones (`selectinload`) se hace en el repositorio, no en el Service ni en el Router — porque los `Response` schemas anidan objetos relacionados y SQLAlchemy async no permite lazy-loading fuera del `await` que originó la query.

## Response Models

- Cada entidad expone hasta cuatro schemas Pydantic, todos con `model_config = ConfigDict(from_attributes=True)` (para poder construirse directamente desde el objeto ORM):
  - **`XCreate`**: campos aceptados al crear. Usa `Field(...)` con restricciones (`min_length`, `max_length`, `ge`, `gt`) que espejan los `CheckConstraint`/`nullable` del modelo.
  - **`XUpdate`**: los mismos campos que `XCreate`, todos opcionales (`default=None`) — actualización parcial; el Service solo pisa los campos que vienen no-`None`.
  - **`XResponse`**: todos los campos relevantes del modelo, más `id`, `created_at`, `updated_at`, y relaciones anidadas como su **`Summary`** (nunca el `Response` completo de la entidad relacionada, para no anidar payloads completos innecesariamente).
  - **`XSummary`**: versión mínima (`id` + 1-2 campos identificadores, p. ej. `id`+`name`) usada exclusivamente para embeberse dentro de otro `Response` (p. ej. `SaleResponse.customer: CustomerSummary`, `PurchaseLineResponse.product: ProductSummary`).
- El Router nunca construye un schema manualmente — devuelve el modelo SQLAlchemy tal cual, y FastAPI lo serializa contra `response_model` usando `from_attributes=True`.

## Error Handling

Cuatro excepciones de dominio, todas `Exception` planas sin lógica (`app/core/exceptions.py`):

```python
class AppException(Exception): pass
class NotFoundException(AppException): pass
class ConflictException(AppException): pass
class BadRequestException(AppException): pass
```

Registradas como exception handlers globales en `app/main.py`, cada una mapea a un status HTTP fijo y devuelve `{"detail": str(exc)}`:

| Excepción | Status | Cuándo se usa |
|---|---|---|
| `NotFoundException` | 404 | la entidad referenciada no existe |
| `ConflictException` | 409 | violación de unicidad de negocio detectada *antes* de escribir (duplicado ya validado) |
| `BadRequestException` | 400 | regla de negocio violada (estado inválido, cantidad insuficiente, combinación de campos inválida) |
| `AppException` | 400 | fallback genérico si alguna vez se lanza la clase base directamente |

## IntegrityError

Además de las excepciones de dominio, existe un handler global para `sqlalchemy.exc.IntegrityError` que responde **409** con un mensaje genérico (`"The request conflicts with existing data."`). Es una red de seguridad, no el mecanismo principal de validación: cada Service intenta detectar duplicados *antes* de escribir (vía `xxx_exists()` en el repositorio) y lanzar `ConflictException` con un mensaje específico; el handler de `IntegrityError` solo entra en juego si, pese a esa comprobación previa, una condición de carrera concurrente hace que PostgreSQL rechace la escritura de todos modos.

## HTTP Status

| Método | Status típico | Notas |
|---|---|---|
| `POST` (crear) | `201 Created` | siempre con `response_model` |
| `GET` (uno o listado) | `200 OK` (default de FastAPI) | |
| `PUT` (actualizar) | `200 OK` (default) | solo en entidades con soft delete; nunca en `Purchase`/`Sale` |
| `DELETE` (soft delete) | `204 No Content` | sin `response_model`, no devuelve body |
| Validación de schema Pydantic fallida | `422 Unprocessable Entity` | automático de FastAPI, antes de llegar al Router |
| Excepción de dominio | `400` / `404` / `409` | ver tabla de Error Handling |

## Validaciones

Dos niveles, con responsabilidades separadas:

1. **Nivel schema (Pydantic, en el Router antes de llegar al Service)**: forma y rango de un campo aislado — `min_length`/`max_length` en strings, `ge`/`gt` en números, `min_length=1` en listas (p. ej. `SaleCreate.lines`/`PurchaseCreate.lines` no pueden venir vacías). Errores acá son `422`, generados por FastAPI sin que el código del proyecto intervenga.
2. **Nivel Service (reglas de negocio, requieren consultar la base de datos o cruzar varios campos)**: existencia (`Product`/`Supplier`/`Customer` referenciado), estado (`is_active`, `ProductUnitStatus`), unicidad de negocio (`sku`, `document_id`, IMEI), reglas cruzadas (`sale_price >= cost_price`, `quantity == 1` para líneas seriales, stock disponible suficiente). Errores acá son excepciones de dominio (`400`/`404`/`409`).

## Convenciones de nombres

- Carpeta de módulo: nombre de entidad en singular y `snake_case` (`supplier`, `customer`, `sale`, no `suppliers`/`sales`).
- Archivo prefijado con el nombre de la entidad: `supplier_repository.py`, `supplier_service.py`, `supplier_router.py`, `supplier_create.py`, etc. — nunca `repository.py` a secas.
- Tabla de base de datos: nombre de entidad en singular (`purchase`, no `purchases`); tabla de línea como `<entidad>_line` (`purchase_line`, `sale_line`).
- Constraints/índices: generados automáticamente por la `naming_convention` de `Base.metadata` (`app/core/database/base.py`) — `ix_<tabla>_<columna>`, `uq_<tabla>_<columna>`, `ck_<tabla>_<constraint_name>`, `fk_<tabla>_<columna>_<tabla_referida>`, `pk_<tabla>`. Nunca se nombran constraints a mano fuera de este esquema.
- Migraciones Alembic: `<revision_hash>_create_<modulo>_table(s).py`.
- Enums Python: `class X(str, Enum)`, un archivo por enum bajo `<modulo>/enums/`, valores en minúscula (`"confirmed"`, `"in_stock"`).

## Convenciones de Services

- Constructor recibe solo `session: AsyncSession` — nunca recibe repositorios ya construidos desde afuera; el propio Service instancia los suyos.
- Un Service puede instanciar y usar directamente el `Repository` de otra entidad "simple" para lecturas de validación (p. ej. `PurchaseService`/`SaleService` usan `ProductRepository`, `SupplierRepository`, `CustomerRepository` directamente).
- Un Service **nunca** instancia ni importa los repositorios internos de `InventoryService` (`ProductUnitRepository`, `StockLotRepository`, `StockMovementRepository`). Toda modificación de inventario pasa exclusivamente por métodos públicos de `InventoryService`, recibiendo un schema de entrada dedicado (`SerialIntakeCreate`, `BatchSaleCreate`, etc.) y devolviendo el modelo resultante.
- Transacciones: ver `transaction-flow.md` para el detalle completo. Resumen: servicios de una sola entidad hacen `commit()` por método; servicios orquestadores (`Purchase`, `Sale`) hacen `flush()` internamente y **un único `commit()`** al final; `InventoryService` nunca hace `commit()`.
- Los métodos públicos de un Service devuelven modelos SQLAlchemy, nunca schemas Pydantic construidos a mano — la conversión la hace FastAPI vía `response_model`.
- Validaciones multi-línea que requieren revisar todo el payload antes de escribir nada (duplicados dentro del mismo request, cantidades acumuladas por producto) se resuelven en un método privado de pre-validación (`_validate_lines`) que corre **antes** de crear cualquier fila — nunca a mitad de la escritura.

## Convenciones de Repositories

- Extienden `BaseRepository[Model]`, pasando el modelo concreto al `super().__init__(session, Model)`.
- Métodos de existencia siguen el patrón `x_exists(valor) -> bool`, implementados como `return await self.get_by_x(valor) is not None` (nunca una query `COUNT` separada para esto).
- Listados filtrados usan el patrón `get_active()` / `list_by_y(y_id)`, siempre devolviendo `list[Model]` (nunca `Sequence` ni un generador).
- Cuando el resultado alimenta un `Response` con relaciones anidadas, el repositorio sobreescribe `get_by_id` (y los métodos de listado que correspondan) agregando `.options(selectinload(...))` — nunca se deja que el Router o el Service decidan qué precargar.
- Operaciones que requieren proteger una fila de modificaciones concurrentes (decrementar stock) usan `get_for_update(id)` con `.with_for_update()`, siempre devolviendo `Model | None` igual que el resto de los `get_by_*`.
