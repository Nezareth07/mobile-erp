# Modelo de dominio — MobileERP Backend

Documenta el dominio tal como existe en el código hoy. MobileERP es un ERP especializado para una tienda física de celulares, accesorios y algunos electrodomésticos (con tienda online planeada a futuro) — no un ERP genérico. La particularidad central del dominio es que el catálogo mezcla productos que requieren trazabilidad por unidad (celulares, vía IMEI) con productos que se manejan por cantidad (accesorios), y el modelo de Inventory está construido explícitamente alrededor de esa distinción.

## Diagrama de relaciones (visión general)

```
Brand ──┐
        ├──< Product >── TrackingType (none | serial | batch)
Category┘      │
                ├──< ProductUnit  (SERIAL)  ─┐
                ├──< StockLot     (BATCH/NONE)├──< StockMovement (ledger)
                └──< StockMovement            ┘         │
                                                     Location
Supplier ──< Purchase ──< PurchaseLine >── Product
                              │
                              └──(crea)──> ProductUnit / StockLot

Customer ──< Sale ──< SaleLine >── Product
                          │
                          └──(consume, vía InventoryService)──> ProductUnit / StockLot
```

`Location` es referenciada por `ProductUnit`, `StockLot`, `StockMovement`, `Purchase` y `Sale` — es el punto de scoping físico (tienda/almacén) de todo movimiento de inventario, aunque hoy el proyecto opera con una única ubicación activa en la práctica.

---

## Brand

**Responsabilidad**: catálogo simple de marcas (Apple, Samsung, Motorola, Xiaomi, ...) para clasificar productos.

**Relaciones**: `Brand 1 ──< N Product` (`Product.brand_id`, `back_populates="products"`).

**Reglas de negocio**:
- `name` único (soft-delete, nunca se borra físicamente).
- Baja lógica vía `is_active = False`.

**Campos importantes**:

| Campo | Tipo | Notas |
|---|---|---|
| `name` | `String(100)` | NOT NULL, único, indexado |
| `is_active` | `bool` | default `True` |

---

## Category

**Responsabilidad**: catálogo simple de categorías de producto (Celulares, Accesorios, ...).

**Relaciones**: `Category 1 ──< N Product` (`Product.category_id`, `back_populates="products"`).

**Reglas de negocio**: idénticas a Brand (nombre único, soft-delete).

**Campos importantes**: igual estructura que Brand (`name`, `is_active`).

---

## Product

**Responsabilidad**: entidad central del catálogo. Define **cómo se rastrea** cada tipo de producto (`tracking_type`) — la decisión que determina el comportamiento de todo el módulo Inventory aguas abajo.

**Relaciones**:
- `Product N ── 1 Brand`, `Product N ── 1 Category`.
- `Product 1 ──< N ProductUnit` (si `tracking_type == SERIAL`).
- `Product 1 ──< N StockLot` (si `tracking_type` es `BATCH` o `NONE`).
- `Product 1 ──< N StockMovement`, `PurchaseLine`, `SaleLine`.

**Reglas de negocio**:
- `sku` único.
- `sale_price` no puede ser menor a `cost_price` al crear o actualizar (`ProductService.create_product`/`update_product`).
- `cost_price` se actualiza como efecto secundario de cada `PurchaseLine` confirmada (`product.cost_price = line_data.unit_cost`) — es un valor de referencia ("último costo de compra"), **no** la fuente de verdad para el costo de una venta específica (eso lo dan `ProductUnit.unit_cost` / `StockLot.unit_cost`, ver más abajo).
- Baja lógica vía `is_active = False`; un producto inactivo no puede usarse en nuevas compras ni ventas, pero sigue siendo legible en registros históricos.

**Campos importantes**:

| Campo | Tipo | Notas |
|---|---|---|
| `sku` | `String(50)` | NOT NULL, único, indexado |
| `tracking_type` | `Enum(TrackingType)` | `none` \| `serial` \| `batch` — NOT NULL, sin default |
| `cost_price` | `Numeric(12,2)` | `>= 0`, "último costo de compra" |
| `sale_price` | `Numeric(12,2)` | `>= 0`, precio de lista, default para `SaleLine.unit_price` |
| `is_active` | `bool` | default `True` |

**`TrackingType`** (`app/modules/product/enums/tracking_type.py`):
- `NONE`: sin trazabilidad individual (a nivel de código, se maneja igual que `BATCH` — ambos usan `StockLot`).
- `SERIAL`: requiere IMEI, se rastrea unidad por unidad vía `ProductUnit`.
- `BATCH`: se rastrea por cantidad dentro de un lote (`StockLot`), sin identidad individual.

---

## Inventory

El módulo Inventory no es una sola entidad — es el subsistema compuesto por `Location`, `ProductUnit`, `StockLot` y `StockMovement`, más `InventoryService` como único responsable de mutarlos. Ningún otro Service del proyecto escribe directamente sobre estas tablas.

### Location

**Responsabilidad**: representa una ubicación física (tienda, almacén, canal online) donde vive el stock.

**Relaciones**: referenciada por `ProductUnit.location_id`, `StockLot.location_id`, `StockMovement.location_id`, `Purchase.location_id`, `Sale.location_id`.

**Reglas de negocio**:
- `name` único.
- `InventoryService.resolve_location(location_id)`: si no se especifica una ubicación, se resuelve automáticamente a la primera `Location` activa creada (`order_by(created_at).limit(1)`) — si no hay ninguna activa, `NotFoundException`.

**Campos importantes**:

| Campo | Tipo | Notas |
|---|---|---|
| `name` | `String(100)` | único |
| `type` | `Enum(LocationType)` | `store` \| `warehouse` \| `online` |
| `is_active` | `bool` | default `True` |

### ProductUnit

**Responsabilidad**: representa **una unidad física individual** de un producto `SERIAL` (un celular concreto, identificado por IMEI). Es la tabla que sostiene la trazabilidad "quién tiene este teléfono exacto".

**Relaciones**:
- `ProductUnit N ── 1 Product`, `N ── 1 Location`.
- `ProductUnit N ── 1 PurchaseLine` (`purchase_line_id`, nullable — de qué línea de compra se originó).
- `ProductUnit N ── 1 SaleLine` (`sale_line_id`, nullable — a qué venta se llevó esta unidad; agregado durante el módulo Sale, pensado para que Warranty/Devoluciones lo reutilicen sin migraciones adicionales).
- `ProductUnit 1 ──< N StockMovement` (vía `StockMovement.product_unit_id`).

**Reglas de negocio**:
- `imei` único y obligatorio; `imei2` único si está presente (dual SIM).
- `status` (`ProductUnitStatus`) modela el ciclo de vida de la unidad: `IN_STOCK` → `SOLD` (al venderse, `InventoryService.register_serial_sale`) o → otros estados vía ajuste manual (`adjust_stock`). Una unidad `SOLD` no puede volver a venderse (`ConflictException`).
- `unit_cost` es el costo **real de esa unidad específica**, fijado en el momento de la compra — dos unidades del mismo producto pueden tener costos distintos si se compraron en momentos/precios diferentes. Es la fuente de verdad del costo de una venta serial (ver `transaction-flow.md`, sección COGS).

**Campos importantes**:

| Campo | Tipo | Notas |
|---|---|---|
| `imei` | `String(15)` | NOT NULL, único, indexado |
| `imei2` | `String(15) \| None` | único si presente |
| `status` | `Enum(ProductUnitStatus)` | `in_stock` \| `reserved` \| `sold` \| `in_warranty` \| `defective` \| `returned_to_supplier` — default `in_stock` |
| `unit_cost` | `Numeric(12,2)` | `>= 0`, costo real de esta unidad |
| `purchase_line_id` | UUID \| None | origen (compra) |
| `sale_line_id` | UUID \| None | destino (venta) |

> `RESERVED`, `IN_WARRANTY`, `DEFECTIVE` y `RETURNED_TO_SUPPLIER` existen como valores del enum pero **no tienen ningún flujo que los asigne todavía** — están preparados para los módulos futuros de Warranty/Devoluciones, sin lógica implementada hoy (mismo patrón que `PurchaseStatus.CANCELLED`).

### StockLot

**Responsabilidad**: representa un **lote** de stock para productos `BATCH`/`NONE` — cantidad recibida en un momento dado, a un costo dado, sin identidad individual por unidad.

**Relaciones**: `StockLot N ── 1 Product`, `N ── 1 Location`, `N ── 1 PurchaseLine` (nullable). `StockLot 1 ──< N StockMovement`.

**Reglas de negocio**:
- `quantity_available <= quantity_received` (constraint de base de datos) — nunca se puede "sobre-disponibilizar" un lote.
- Los lotes se consumen en orden **FIFO** por `received_at` (el más antiguo primero), tanto en ajustes manuales de salida como en ventas.
- `unit_cost` es el costo real de ese lote específico — dos lotes del mismo producto pueden tener costos distintos (compras en momentos distintos), y es la base del cálculo de COGS por FIFO en una venta (ver `transaction-flow.md`).
- No tiene `updated_at` (solo `received_at`, fijado en la creación) — `quantity_available` sí se actualiza in-place con cada consumo, a diferencia de `StockMovement` que es 100% inmutable.

**Campos importantes**:

| Campo | Tipo | Notas |
|---|---|---|
| `lot_code` | `String(50) \| None` | opcional, libre |
| `quantity_received` | `int` | cantidad original |
| `quantity_available` | `int` | `0 <= x <= quantity_received` |
| `unit_cost` | `Numeric(12,2)` | costo real de este lote |
| `received_at` | `DateTime` | usado para ordenar FIFO |

### StockMovement

**Responsabilidad**: **ledger inmutable** — un registro histórico de cada entrada/salida de stock, sin excepción. Nunca se edita ni se borra; cualquier corrección futura (cancelaciones, devoluciones) se modela como un movimiento nuevo, no como una edición del original.

**Relaciones**: `StockMovement N ── 1 Product`, `N ── 1 Location`, y **exactamente uno** de `product_unit_id` o `stock_lot_id` (constraint de base de datos: `exactly_one_stock_reference` — nunca ambos, nunca ninguno).

**Reglas de negocio**:
- `movement_type` (`MovementType`) describe la naturaleza del movimiento: `purchase_in`, `sale_out`, `adjustment_in/out`, `return_in/out`, `warranty_in/out`, `transfer_in/out`. Hoy solo `purchase_in`, `sale_out` y `adjustment_in/out` tienen flujos reales que los generan; el resto está preparado para módulos futuros (Devoluciones, Garantías, Transferencias entre ubicaciones).
- `source_type` (`MovementSourceType`: `manual` \| `purchase` \| `sale` \| `warranty` \| `transfer`) identifica qué proceso originó el movimiento; `source_reference` guarda el id del registro de origen como texto (p. ej. `str(purchase.id)` o `str(sale.id)`).
- Sin `updated_at` — cada fila se escribe una sola vez y no vuelve a tocarse.
- Una línea de venta `BATCH` que se reparte entre varios lotes (consumo FIFO multi-lote) genera **un `StockMovement` por lote consumido**, todos con el mismo `source_reference` (el id de la venta).

**Campos importantes**:

| Campo | Tipo | Notas |
|---|---|---|
| `movement_type` | `Enum(MovementType)` | ver arriba |
| `product_unit_id` / `stock_lot_id` | UUID \| None | exactamente uno de los dos |
| `quantity` | `int \| None` | `None` para movimientos de unidad serial; cantidad para movimientos de lote |
| `unit_cost` | `Numeric(12,2)` | costo al momento del movimiento |
| `source_type` / `source_reference` | enum / string | trazabilidad hacia el proceso que lo originó |

---

## Supplier

**Responsabilidad**: catálogo de proveedores a quienes se les compra mercadería.

**Relaciones**: `Supplier 1 ──< N Purchase` (relación unidireccional — `Purchase.supplier` existe, `Supplier` no expone una colección `purchases`).

**Reglas de negocio**:
- `name` único; `tax_id` único si está presente.
- Baja lógica vía `is_active = False`; un proveedor inactivo no puede usarse en compras nuevas (`PurchaseService` valida `supplier.is_active`).

**Campos importantes**: `name`, `tax_id` (nullable, único), `contact_name`, `phone`, `email`, `address`, `notes`, `is_active`.

---

## Purchase

**Responsabilidad**: registra la compra de mercadería a un proveedor como una única operación atómica — valida las líneas, crea el header, y por cada línea da entrada al inventario correspondiente (`ProductUnit` o `StockLot`, según `tracking_type`).

**Relaciones**: `Purchase N ── 1 Supplier`, `N ── 1 Location`; `Purchase 1 ──< N PurchaseLine` (`back_populates`, `order_by=PurchaseLine.created_at`).

**Reglas de negocio**:
- `status` (`PurchaseStatus`: `confirmed` \| `cancelled`) — solo `CONFIRMED` tiene flujo implementado hoy; `CANCELLED` existe en el enum pero no hay ningún endpoint ni lógica que lo asigne (patrón "preparar el enum, no la feature").
- `total_cost = Σ (line.quantity × line.unit_cost)`, calculado una sola vez al crear la compra.
- Cada línea `SERIAL` exige `quantity == 1` e `imei` presente; IMEIs duplicados dentro del mismo request se rechazan, igual que IMEIs ya existentes en el sistema.
- Cada línea confirmada actualiza `Product.cost_price` al costo de esa compra (último costo gana, sin promediar).
- Sin `PUT`/`DELETE` — una compra confirmada no se edita ni se borra vía API hoy.

**Campos importantes**: `supplier_id`, `location_id`, `status`, `invoice_number` (opcional), `purchase_date`, `total_cost`, `notes`.

---

## PurchaseLine

**Responsabilidad**: una línea individual dentro de una compra — un producto, una cantidad, un costo unitario.

**Relaciones**: `PurchaseLine N ── 1 Purchase` (`ondelete=CASCADE`), `N ── 1 Product`. Es además el origen de trazabilidad de `ProductUnit.purchase_line_id` / `StockLot.purchase_line_id`.

**Reglas de negocio**: `quantity > 0`, `unit_cost >= 0`, `subtotal >= 0` (`subtotal = quantity × unit_cost`, fijado al crear). `imei`/`imei2` solo válidos si la línea es de un producto `SERIAL`; `lot_code` es libre y opcional para líneas `BATCH`/`NONE`.

**Campos importantes**: `product_id`, `quantity`, `unit_cost`, `subtotal`, `imei`, `imei2`, `lot_code`. Sin `updated_at` (solo `created_at`) — una línea de compra, una vez creada, no se vuelve a tocar.

---

## Customer

**Responsabilidad**: registro mínimo de cliente necesario para sostener venta, garantía y reporte con trazabilidad — no es un CRM.

**Relaciones**: `Customer 1 ──< N Sale` (relación unidireccional, igual que Supplier/Purchase).

**Reglas de negocio**:
- `document_id` (cédula/RUC/DNI) es **siempre opcional**, pero único cuando está presente (índice único **parcial**: `WHERE document_id IS NOT NULL`) — permite múltiples clientes sin documento sin violar unicidad.
- `name` **no** es único (a diferencia de Supplier) — es normal tener varios clientes con el mismo nombre; la identidad real la da `document_id`.
- Baja lógica vía `is_active = False`; un cliente inactivo no puede usarse en ventas nuevas pero sigue siendo legible en historiales.
- `is_default_customer` marca al cliente usado automáticamente cuando una venta no especifica `customer_id` ("consumidor final"). **El campo existe en el modelo pero no está expuesto en `CustomerCreate`/`CustomerUpdate`** — hoy solo puede activarse manualmente en la base de datos, no vía API (gap conocido, documentado en `backend-roadmap.md`).

**Campos importantes**: `name`, `document_id` (nullable, único parcial), `phone`, `email`, `address`, `notes`, `is_active`, `is_default_customer`.

---

## Sale

**Responsabilidad**: registra la venta de productos a un cliente como una única operación atómica — valida disponibilidad, descuenta inventario de la fuente correcta (unidad serial o lote), fija precio y costo de cada línea de forma inmutable, y calcula el total cobrado y la utilidad real.

**Relaciones**: `Sale N ── 1 Customer`, `N ── 1 Location`; `Sale 1 ──< N SaleLine` (`back_populates`, `order_by=SaleLine.created_at`).

**Reglas de negocio**:
- `status` (`SaleStatus`: `confirmed` \| `cancelled`) — mismo patrón que `PurchaseStatus`: solo `CONFIRMED` tiene flujo implementado; la cancelación quedó **explícitamente fuera de esta primera versión**.
- Si no se especifica `customer_id`, se resuelve al cliente con `is_default_customer=True` activo; si no existe ninguno, la venta falla explícitamente (`BadRequestException`) — nunca se crea una venta con `customer_id` nulo.
- `total_amount`, `total_cost` y `profit` se calculan una sola vez al confirmar la venta y **quedan congelados** — no se recalculan aunque `Product.sale_price`/`cost_price` cambien después. Es lo que garantiza que un reporte histórico de utilidad siga siendo correcto en el futuro.
- `total_cost` usa el costo real consumido (`ProductUnit.unit_cost` para líneas seriales; costo promedio ponderado de los lotes FIFO consumidos para líneas batch) — nunca `Product.cost_price` (que es solo referencia).
- Sin `PUT` — una venta confirmada no se edita; un error se corrige cancelando y creando una venta nueva (cancelación aún no implementada). Sin `DELETE` — una venta nunca se borra físicamente.

**Campos importantes**: `customer_id`, `location_id`, `status`, `sale_date`, `total_amount`, `total_cost`, `profit`, `notes`.

---

## SaleLine

**Responsabilidad**: una línea individual dentro de una venta — un producto, una cantidad, un precio de venta y el costo real consumido para esa línea.

**Relaciones**: `SaleLine N ── 1 Sale` (`ondelete=CASCADE`), `N ── 1 Product`. Es el destino de trazabilidad de `ProductUnit.sale_line_id` (qué venta se llevó esa unidad exacta).

**Reglas de negocio**:
- `quantity > 0`, `unit_price >= 0`, `unit_cost >= 0`, `subtotal >= 0` (`subtotal = quantity × unit_price`).
- `unit_price` se toma del valor enviado o, si no se especifica, del `Product.sale_price` vigente al momento de la venta.
- `unit_cost` se fija **después** de que `InventoryService` resuelve el descuento real de inventario (no se conoce de antemano como en Purchase, donde el costo lo define quien compra) — para líneas `SERIAL` es el `unit_cost` exacto de la unidad vendida; para líneas `BATCH`/`NONE` es el promedio ponderado de los lotes efectivamente consumidos.
- `imei` solo presente en líneas de productos `SERIAL`; `quantity` debe ser exactamente `1` en ese caso.

**Campos importantes**: `product_id`, `quantity`, `unit_price`, `unit_cost`, `subtotal`, `imei`. Sin `updated_at` (solo `created_at`) — igual que `PurchaseLine`, inmutable una vez creada.
