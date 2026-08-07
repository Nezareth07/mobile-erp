# Flujo transaccional — MobileERP Backend

Documenta los procesos multi-entidad implementados hoy: **Compra** (Purchase) y **Venta** (Sale). Ambos son los únicos procesos del sistema que orquestan varias entidades y otro Service (`InventoryService`) dentro de una sola transacción de base de datos. El resto de los módulos (Brand, Category, Supplier, Customer, Product) son operaciones de una sola entidad y no requieren esta orquestación.

## Regla transaccional general

- **El Service que expone el caso de uso es el único dueño de la transacción.** Hace `flush()` cuantas veces necesite (para obtener IDs generados antes de continuar), y **un único `commit()`** al final, después de que todas las escrituras del proceso completo se resolvieron sin errores.
- **`InventoryService` nunca hace `commit()`.** Es invocado desde `PurchaseService`/`SaleService` (que comparten la misma `AsyncSession`) o directamente desde `inventory_router.py` para sus propios endpoints (`/inventory/intake/*`, `/inventory/adjustments`), en cuyo caso es el **Router** el que hace `session.commit()` explícito después de llamar al servicio — nunca el propio `InventoryService`.
- Si cualquier paso intermedio lanza una excepción (`NotFoundException`, `ConflictException`, `BadRequestException`, o un `IntegrityError` de PostgreSQL), el `commit()` final nunca se ejecuta. La excepción propaga hasta el exception handler global de FastAPI, que construye la respuesta de error — y como la dependencia `get_session` cierra la sesión al salir del bloque `async with` (incluso por excepción), cualquier `INSERT`/`UPDATE` que ya se había hecho `flush()` pero no `commit()` **se descarta**: PostgreSQL nunca ve una transacción confirmada, por lo que no persiste nada. Este es el mecanismo real de rollback — no hay un `try/except` con `rollback()` explícito en el código; la atomicidad se logra por *ausencia* de commit.

---

## Compra (Purchase)

```
POST /purchases
   │
   ▼
PurchaseRouter.create_purchase(data)
   │
   ▼
PurchaseService.create_purchase(data)
   │
   ├─ 1. Fetch + validar Supplier (existe, is_active)         [SupplierRepository]
   ├─ 2. InventoryService.resolve_location(data.location_id)   [InventoryService]
   ├─ 3. _validate_lines(data)  — pre-pase sin efectos secundarios
   │       por cada línea:
   │         - producto existe y activo                        [ProductRepository]
   │         - SERIAL: quantity==1, imei presente, sin duplicados
   │           en el request, IMEI no registrado todavía        [InventoryService.imei_exists]
   │         - BATCH/NONE: sin imei
   │
   ├─ 4. total_cost = Σ (line.quantity × line.unit_cost)
   ├─ 5. crear Purchase(status=CONFIRMED, total_cost, ...)
   │       PurchaseRepository.create(purchase)
   │       await session.flush()                    ← obtiene purchase.id
   │
   ├─ 6. por cada línea:
   │       a. crear PurchaseLine(purchase_id, product_id, quantity, unit_cost, subtotal, ...)
   │          PurchaseLineRepository.create(line)
   │          await session.flush()                 ← obtiene purchase_line.id
   │
   │       b. si SERIAL:
   │            InventoryService.register_serial_intake(SerialIntakeCreate(...), purchase_line_id)
   │              └─ crea ProductUnit(status=IN_STOCK, unit_cost, purchase_line_id)
   │              └─ crea StockMovement(PURCHASE_IN, product_unit_id, source_type=PURCHASE)
   │              └─ await session.flush()  (dentro de InventoryService, NUNCA commit)
   │
   │       c. si BATCH/NONE:
   │            InventoryService.register_batch_intake(BatchIntakeCreate(...), purchase_line_id)
   │              └─ crea StockLot(quantity_received=quantity_available=quantity, unit_cost, purchase_line_id)
   │              └─ crea StockMovement(PURCHASE_IN, stock_lot_id, quantity, source_type=PURCHASE)
   │              └─ await session.flush()
   │
   │       d. product.cost_price = line.unit_cost   (efecto secundario: último costo)
   │
   ├─ 7. await session.commit()          ← ÚNICO commit de todo el proceso
   │
   └─ 8. return get_purchase(purchase.id)   (re-fetch con selectinload de supplier/location/lines.product)
```

Si el paso 3 rechaza una línea (p. ej. IMEI duplicado), **nada** de lo anterior llegó siquiera a construirse — la validación es un pre-pase sin escritura. Si el paso 6 falla a mitad de camino (p. ej. una línea 3 de 5 dispara un `IntegrityError` inesperado), las líneas 1 y 2 ya estaban `flush()`eadas pero no `commit()`eadas: al propagar la excepción, se descartan junto con todo lo demás.

---

## Venta (Sale)

Misma forma que Purchase, con una diferencia estructural importante: en Purchase el costo de cada línea lo define quien compra (`unit_cost` viene en el request); en Sale el **costo** de cada línea no se conoce hasta que `InventoryService` resuelve *qué* unidad/lote específico se consumió — por eso el costo y la utilidad de la venta se terminan de calcular *después* del bucle de líneas, no antes.

```
POST /sales
   │
   ▼
SaleRouter.create_sale(data)
   │
   ▼
SaleService.create_sale(data)
   │
   ├─ 1. _resolve_customer(data.customer_id)                    [CustomerRepository]
   │       - con id: fetch, valida existe y is_active
   │       - sin id: busca Customer.is_default_customer=True activo
   │         → si no existe ninguno: BadRequestException explícito
   │
   ├─ 2. InventoryService.resolve_location(data.location_id)    [InventoryService]
   │
   ├─ 3. _validate_lines(data)  — pre-pase sin efectos secundarios
   │       por cada línea:
   │         - producto existe y activo                          [ProductRepository]
   │         - SERIAL: quantity==1, imei presente, sin duplicados
   │           en el request, unidad existe y status==IN_STOCK    [InventoryService.get_unit_by_imei]
   │         - BATCH/NONE: sin imei, acumula cantidad pedida por producto
   │       al final: valida que el stock disponible total alcance
   │       para cada producto BATCH/NONE pedido                  [InventoryService.get_available_stock]
   │
   ├─ 4. crear Sale(status=CONFIRMED, total_amount=0, total_cost=0, profit=0, ...)
   │       SaleRepository.create(sale)
   │       await session.flush()                    ← obtiene sale.id
   │
   ├─ 5. por cada línea:
   │       a. unit_price = line.unit_price o product.sale_price (default)
   │          subtotal = quantity × unit_price
   │          crear SaleLine(sale_id, product_id, quantity, unit_price, unit_cost=0, subtotal, imei)
   │          SaleLineRepository.create(line)
   │          await session.flush()                 ← obtiene sale_line.id
   │
   │       b. si SERIAL:
   │            InventoryService.register_serial_sale(SerialSaleCreate(...), sale_line_id)
   │              └─ localiza ProductUnit por imei, bloquea la fila (get_for_update)
   │              └─ valida status==IN_STOCK (409 si SOLD, 400 si otro estado)
   │              └─ status = SOLD, unit.sale_line_id = sale_line.id
   │              └─ crea StockMovement(SALE_OUT, product_unit_id, source_type=SALE)
   │              └─ await session.flush()
   │            line_cost = unit.unit_cost
   │
   │       c. si BATCH/NONE:
   │            InventoryService.register_batch_sale(BatchSaleCreate(...))
   │              └─ recorre StockLot del producto en orden FIFO (received_at)
   │              └─ por cada lote con stock: bloquea (get_for_update), consume
   │                 min(disponible, restante), decrementa quantity_available
   │              └─ crea un StockMovement(SALE_OUT, stock_lot_id, quantity_consumida)
   │                 POR CADA LOTE TOCADO (una línea puede generar varios movimientos)
   │              └─ si al final no se cubrió la cantidad pedida: BadRequestException
   │              └─ await session.flush()
   │            line_cost = costo total consumido / quantity   (promedio ponderado)
   │
   │       d. sale_line.unit_cost = line_cost
   │          total_amount += subtotal
   │          total_cost   += line_cost × quantity
   │
   ├─ 6. sale.total_amount, sale.total_cost, sale.profit = totales calculados
   │       (profit = total_amount - total_cost)
   │
   ├─ 7. await session.commit()          ← ÚNICO commit de todo el proceso
   │
   └─ 8. return get_sale(sale.id)   (re-fetch con selectinload de customer/location/lines.product)
```

---

## Atomicidad

En ambos procesos, "atómico" significa: **o se registra la compra/venta completa con todo su efecto en inventario, o no se registra nada**. No existe un estado intermedio persistido donde el header exista pero falte una línea, o donde el inventario se haya descontado pero la venta no. Esto se logra estructuralmente, no con manejo de errores explícito:

- Todas las escrituras del proceso (header, líneas, unidades/lotes, movimientos) comparten la misma `AsyncSession`.
- Ninguna escritura intermedia hace `commit()` — solo `flush()` (que envía el SQL a PostgreSQL dentro de la transacción abierta, pero no la cierra).
- El único punto que puede cerrar la transacción con éxito es la última línea del método del Service orquestador.

## Rollback

No hay un bloque `try/except` que llame a `session.rollback()` explícitamente en ningún Service. El rollback ocurre por construcción:

1. Una regla de negocio falla (o PostgreSQL rechaza un `flush()` por un `IntegrityError`, p. ej. una carrera de concurrencia que el pre-chequeo no detectó).
2. Se lanza una excepción tipada (o el `IntegrityError` propaga sin capturar).
3. La excepción sube por `PurchaseService`/`SaleService` → `Router` → FastAPI.
4. El exception handler global (`app/main.py`) construye la respuesta de error (404/409/400, o 409 genérico para `IntegrityError`).
5. La dependencia `get_session` (`async with SessionFactory() as session: yield session`) se cierra al desenrollarse la pila por la excepción — cerrar una sesión con trabajo pendiente sin `commit()` descarta esa transacción en PostgreSQL.

## Ledger (StockMovement)

`StockMovement` es la única fuente histórica de verdad sobre qué pasó con el stock. Es **append-only**: nunca se actualiza ni se borra una fila existente. Cada entrada/salida de inventario, sin importar el proceso que la originó, produce una fila nueva con:

- `movement_type`: la naturaleza del movimiento (`purchase_in`, `sale_out`, `adjustment_in/out`, ...).
- `source_type` + `source_reference`: de qué proceso vino y el id de ese registro (compra o venta), permitiendo reconstruir "por qué bajó/subió el stock" en cualquier momento sin depender de que el registro de origen siga existiendo con el mismo estado.
- Exactamente una referencia a `ProductUnit` o `StockLot` (nunca ambas, nunca ninguna — constraint de base de datos).

Cualquier corrección futura (cancelar una venta, procesar una devolución) deberá modelarse como **movimientos nuevos que revierten el efecto**, nunca como una edición de los movimientos originales — es el mismo principio de inmutabilidad que aplica a `SaleLine.unit_cost`/`PurchaseLine.unit_cost` una vez fijados.

## FIFO

El consumo de `StockLot` (productos `BATCH`/`NONE`) sigue siempre el orden de llegada (`received_at` ascendente) — el lote más antiguo se consume primero. Esto aplica en dos lugares del código:

- `InventoryService._adjust_lot_quantity` (ajuste manual de salida): consume de **un solo lote**, el más antiguo con stock disponible; si ese lote no alcanza, falla (no reparte entre varios).
- `InventoryService.register_batch_sale` (venta): generaliza lo anterior — recorre los lotes en orden FIFO y **puede repartir el consumo entre varios lotes** hasta cubrir la cantidad pedida, acumulando el costo real de cada lote tocado para calcular el costo promedio ponderado de la línea de venta.

Cada lote se bloquea individualmente (`StockLotRepository.get_for_update`, `SELECT ... FOR UPDATE`) justo antes de decrementarlo, para evitar que dos procesos concurrentes consuman el mismo stock dos veces.

## ProductUnit (trazabilidad serial)

El ciclo de vida real implementado hoy para una unidad `SERIAL`:

```
(compra) register_serial_intake → status = IN_STOCK
                                        │
                    (venta) register_serial_sale
                                        │
                                        ▼
                                  status = SOLD
```

`RESERVED`, `IN_WARRANTY`, `DEFECTIVE`, `RETURNED_TO_SUPPLIER` son estados alcanzables solo vía el endpoint genérico de ajuste manual (`POST /inventory/adjustments` → `_adjust_serial_unit`), que exige indicar explícitamente el `new_status` — no hay ningún flujo de negocio (Garantía, Devolución) que los asigne automáticamente todavía.

Antes de vender una unidad, `register_serial_sale` bloquea su fila (`get_for_update`) y **re-valida** `status == IN_STOCK` dentro de la transacción — la validación previa en `_validate_lines` es solo una comprobación optimista (para dar un error temprano y claro); la comprobación real y definitiva que previene una doble venta bajo concurrencia ocurre aquí, bajo lock.

## StockLot (trazabilidad por lote)

A diferencia de `ProductUnit`, un `StockLot` no tiene un "dueño" final — su `quantity_available` simplemente decrece con cada consumo (ajuste o venta) hasta llegar a `0`, y puede ser tocado por múltiples ventas distintas a lo largo del tiempo. La trazabilidad de qué venta consumió qué cantidad de qué lote vive exclusivamente en `StockMovement` (vía `stock_lot_id` + `source_reference`), no en el propio `StockLot`.
