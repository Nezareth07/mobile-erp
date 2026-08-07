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
| ✔ **Customer** | Registro mínimo de cliente. CRUD con soft delete, `document_id` opcional con unicidad parcial, campo `is_default_customer` preparado para "consumidor final" (no expuesto aún vía API — ver Deuda técnica). |
| ✔ **Sale** | Registro de ventas como operación atómica: valida disponibilidad, descuenta inventario (unidad serial o lotes FIFO, posiblemente varios por línea), calcula costo real y utilidad, congela ambos al confirmar. Sin cancelación implementada (`SaleStatus.CANCELLED` existe en el enum, sin flujo). |

## Pendiente

| Módulo | Propósito |
|---|---|
| **Authentication** | Autenticación de usuarios contra la API (login, emisión/validación de tokens). Prerrequisito de todo lo demás en esta lista — hoy ningún endpoint requiere identidad. |
| **Users** | Registro de usuarios del sistema (empleados que operan el ERP) — hoy no existe ninguna entidad de usuario; es lo que permitiría, por ejemplo, atribuir una venta a un vendedor específico (`Sale.seller_id`, ya identificado como pendiente en el análisis de Sale). |
| **Roles** | Agrupación de permisos por rol (cajero, administrador, etc.) para controlar qué puede hacer cada usuario. |
| **Permissions** | Permisos granulares por acción/recurso, consumidos por Roles y validados en cada endpoint. |
| **Dashboard** | Vista consolidada de indicadores del negocio (ventas del día, stock bajo, utilidad reciente) — de solo lectura sobre datos ya existentes. |
| **Reports** | Reportes administrativos formales (ventas por período, utilidad por producto/cliente, historial de movimientos) — la mayoría de los datos que necesitaría ya existen en `Sale`/`SaleLine`/`StockMovement`, falta la capa de agregación/exportación. |
| **Settings** | Configuración operativa del negocio (datos fiscales, parámetros generales, quizás gestión de `Location` vía API — hoy `Location` no tiene router propio). |
| **Returns** (Devoluciones) | Devolución total o parcial de una venta ya confirmada. La arquitectura actual ya lo contempla sin refactorizar: `SaleLine` tiene identidad propia (`sale_line_id`) referenciable, `ProductUnit.sale_line_id` ya traza qué venta se llevó cada unidad, y `MovementType` ya tiene `RETURN_IN`/`RETURN_OUT` preparados. |
| **Warranty** (Garantías) | Gestión de reclamos de garantía sobre una unidad vendida. `ProductUnitStatus.IN_WARRANTY` ya existe en el enum; falta el flujo que lo asigne y el registro del reclamo en sí. |
| **Payments** | Registro de pagos asociados a una venta, incluyendo pagos mixtos (efectivo + tarjeta + transferencia). `Sale.total_amount` ya es el número contra el que un futuro pago tendría que cuadrar; no se anticipó ningún campo de método de pago en `Sale` precisamente para no bloquear esto. |
| **Billing** (Facturación) | Emisión de comprobantes fiscales sobre una venta confirmada — depende de qué requisitos fiscales aplique el negocio (aún no evaluado). |

## Deuda técnica conocida

Hallazgos reales detectados durante el desarrollo y las auditorías de Purchase/Customer/Sale, no resueltos por estar fuera del alcance aprobado en su momento:

- **`Customer.is_default_customer` no es configurable vía API.** El campo existe en el modelo y `CustomerRepository.get_default()` ya lo consume (usado por Sale para resolver "consumidor final"), pero `CustomerCreate`/`CustomerUpdate` no lo exponen — hoy solo puede activarse con una escritura directa en base de datos. Necesita resolverse antes de operar Sale en producción sin intervención manual.
- **Drift preexistente entre `Purchase.purchase_date` y la base de datos.** El índice `ix_purchase_purchase_date` existe físicamente en la base (creado en una migración anterior) pero el modelo `Purchase` actual no lo declara (`index=True` ausente en `purchase_date`). `alembic check` lo reporta en cada migración nueva; se ha excluido deliberadamente de las migraciones de Customer y Sale por no ser parte de su alcance. Sigue pendiente de una migración correctiva dedicada.
- **Módulo `product` no sigue la convención `dependencies.py`.** Sus routers instancian `ProductService(session)` directamente en vez de usar un `get_product_service` inyectado — funcionalmente equivalente, pero inconsistente con el patrón que se consolidó a partir de Supplier. No se ha refactorizado.
- **Cancelación no implementada en Purchase ni Sale.** Ambos enums de estado (`PurchaseStatus`, `SaleStatus`) tienen `CANCELLED` preparado, pero ningún endpoint ni lógica de servicio lo asigna. El análisis de Sale identificó además que `MovementType` no tiene un valor dedicado para "venta cancelada" (los candidatos existentes, `RETURN_IN`/`ADJUSTMENT_IN`, no representan bien esa semántica) — recomendado agregar uno cuando se implemente.
- **Sin lock de fila en varias rutas de lectura previas a escritura.** `register_serial_sale` sí bloquea el `ProductUnit` antes de venderlo (`get_for_update`, agregado durante Sale), pero la validación optimista en `_validate_lines` (tanto de Purchase como de Sale) lee sin lock — es deliberado (dar un error temprano y claro), y la protección real contra condiciones de carrera ocurre en el paso de escritura, no en la validación previa.
