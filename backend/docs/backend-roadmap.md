# Roadmap — MobileERP Backend

Estado real del backend a la fecha. Refleja únicamente lo implementado y verificado; los módulos pendientes se describen por su propósito de negocio, no por un diseño ya decidido (ninguno de ellos ha pasado por el proceso de análisis + aprobación que usa este proyecto para cada módulo nuevo).

## Completado

| Módulo | Qué hace hoy |
|---|---|
| ✔ **Brand** | Catálogo de marcas. CRUD con soft delete, nombre único. |
| ✔ **Category** | Catálogo de categorías. CRUD con soft delete, nombre único. |
| ✔ **Product** | Catálogo central de productos. Define `tracking_type` (`none`/`serial`/`batch`), `cost_price`/`sale_price`, validación `sale_price >= cost_price`, soft delete. |
| ✔ **Inventory** | Subsistema de stock: `Location`, `ProductUnit` (trazabilidad serial por IMEI), `StockLot` (trazabilidad por lote, FIFO), `StockMovement` (ledger inmutable). `InventoryService` es el único responsable de mutar estas tablas — usado tanto por sus propios endpoints (`/inventory/intake/*`, `/inventory/adjustments`) como por Purchase y Sale. |
| ✔ **Supplier** | Catálogo de proveedores. CRUD con soft delete, nombre y `tax_id` únicos. |
| ✔ **Purchase** | Registro de compras a proveedor como operación atómica: valida líneas, da entrada a inventario (`ProductUnit`/`StockLot` según tracking type), actualiza `Product.cost_price`. Sin cancelación implementada (`PurchaseStatus.CANCELLED` existe en el enum, sin flujo). |
| ✔ **Customer** | Registro mínimo de cliente. CRUD con soft delete, `document_id` opcional con unicidad parcial. `is_default_customer` ("consumidor final") configurable vía `PUT /customers/{id}/default`, con unicidad garantizada por índice único parcial en PostgreSQL. |
| ✔ **Sale** | Registro de ventas como operación atómica: valida disponibilidad, descuenta inventario (unidad serial o lotes FIFO, posiblemente varios por línea), calcula costo real y utilidad, congela ambos al confirmar. Sin cancelación implementada (`SaleStatus.CANCELLED` existe en el enum, sin flujo). |
| ✔ **Auth / Users / Roles / Permissions** | Autenticación JWT (access + refresh) y autorización por permisos granulares agrupados en roles. Incluye CLI idempotente de bootstrap del primer ADMIN (`python -m app.cli.bootstrap_admin`), guard contra bloqueo del último administrador, y bloqueo de fila para serializar la carrera desactivar-rol vs asignar-rol. Los 28 permisos y el rol ADMIN se siembran vía migraciones de Alembic, no vía código de aplicación. |
| ✔ **Dashboard** | Indicadores consolidados del negocio, de solo lectura sobre datos existentes. |
| ✔ **Reports** | Reportes de ventas, compras e inventario (10 endpoints) sobre `Sale`/`SaleLine`/`Purchase`/`StockMovement`. |
| ✔ **Suite de pruebas** | 58 archivos de prueba: unitarias, de integración y de concurrencia real (sin mocks ni `sleep()`). Aislamiento por test vía transacción externa + `join_transaction_mode="create_savepoint"`, sin modificar código de producción. Esquema construido con las migraciones reales, no con `create_all()`. |
| ✔ **Frontend** | Cliente React 19 + TypeScript (Vite, TanStack Query, React Hook Form + Zod, Tailwind 4, Recharts) cubriendo las 10 áreas funcionales. Fuera del alcance de este documento — ver `frontend/README.md`. |

## Pendiente

| Módulo | Propósito |
|---|---|
| **Settings** | Configuración operativa del negocio (datos fiscales, parámetros generales, quizás gestión de `Location` vía API — hoy `Location` no tiene router propio). |
| **Returns** (Devoluciones) | Devolución total o parcial de una venta ya confirmada. La arquitectura actual ya lo contempla sin refactorizar: `SaleLine` tiene identidad propia (`sale_line_id`) referenciable, `ProductUnit.sale_line_id` ya traza qué venta se llevó cada unidad, y `MovementType` ya tiene `RETURN_IN`/`RETURN_OUT` preparados. |
| **Warranty** (Garantías) | Gestión de reclamos de garantía sobre una unidad vendida. `ProductUnitStatus.IN_WARRANTY` ya existe en el enum; falta el flujo que lo asigne y el registro del reclamo en sí. |
| **Payments** | Registro de pagos asociados a una venta, incluyendo pagos mixtos (efectivo + tarjeta + transferencia). `Sale.total_amount` ya es el número contra el que un futuro pago tendría que cuadrar; no se anticipó ningún campo de método de pago en `Sale` precisamente para no bloquear esto. |
| **Billing** (Facturación) | Emisión de comprobantes fiscales sobre una venta confirmada — depende de qué requisitos fiscales aplique el negocio (aún no evaluado). |

## Deuda técnica conocida

Hallazgos reales detectados durante el desarrollo y las auditorías de Purchase/Customer/Sale, no resueltos por estar fuera del alcance aprobado en su momento:

- ~~**Drift preexistente entre `Purchase.purchase_date` y la base de datos.**~~ **Resuelto** en `8201609`: el modelo `Purchase` ahora declara `index=True` en `purchase_date`, alineándolo con el índice `ix_purchase_purchase_date` que ya existía físicamente en la base. `alembic check` ya no lo reporta.
- **Módulo `product` no sigue la convención `dependencies.py`.** Sus routers instancian `ProductService(session)` directamente en vez de usar un `get_product_service` inyectado — funcionalmente equivalente, pero inconsistente con el patrón que se consolidó a partir de Supplier. No se ha refactorizado.
- **Cancelación no implementada en Purchase ni Sale.** Ambos enums de estado (`PurchaseStatus`, `SaleStatus`) tienen `CANCELLED` preparado, pero ningún endpoint ni lógica de servicio lo asigna. El análisis de Sale identificó además que `MovementType` no tiene un valor dedicado para "venta cancelada" (los candidatos existentes, `RETURN_IN`/`ADJUSTMENT_IN`, no representan bien esa semántica) — recomendado agregar uno cuando se implemente.
- **Sin lock de fila en varias rutas de lectura previas a escritura.** `register_serial_sale` sí bloquea el `ProductUnit` antes de venderlo (`get_for_update`, agregado durante Sale), pero la validación optimista en `_validate_lines` (tanto de Purchase como de Sale) lee sin lock — es deliberado (dar un error temprano y claro), y la protección real contra condiciones de carrera ocurre en el paso de escritura, no en la validación previa.
