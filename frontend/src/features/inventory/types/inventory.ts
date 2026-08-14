// Mirrors backend/app/modules/inventory/schemas/*.py and the enums under
// backend/app/modules/inventory/enums/ field-by-field. Decimal fields
// (unit_cost, total_value) are strings on the wire, same contract already
// confirmed for Dashboard/Catalog. Quantity fields are plain ints.

export type TrackingType = 'none' | 'serial' | 'batch'

export type LocationType = 'store' | 'warehouse' | 'online'

export type ProductUnitStatus =
  | 'in_stock'
  | 'reserved'
  | 'sold'
  | 'in_warranty'
  | 'defective'
  | 'returned_to_supplier'

export type MovementType =
  | 'purchase_in'
  | 'sale_out'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_in'
  | 'return_out'
  | 'warranty_out'
  | 'warranty_in'
  | 'transfer_in'
  | 'transfer_out'

export type MovementSourceType =
  | 'manual'
  | 'purchase'
  | 'sale'
  | 'warranty'
  | 'transfer'

export type AdjustmentDirection = 'in' | 'out'

export interface ProductSummary {
  id: string
  name: string
  sku: string
}

export interface LocationSummary {
  id: string
  name: string
  type: LocationType
}

// Minimal product shape needed to show a header on ProductStockPage and to
// populate the movements product filter. Deliberately not imported from
// features/catalog (closed phase F5) -- see errors.ts for the same
// per-feature isolation precedent.
export interface ProductRef {
  id: string
  name: string
  sku: string
  tracking_type: TrackingType
  is_active: boolean
}

export interface ProductUnitResponse {
  id: string
  product_id: string
  imei: string
  imei2: string | null
  status: ProductUnitStatus
  unit_cost: string
  location: LocationSummary
  created_at: string
  updated_at: string
}

export interface StockLotResponse {
  id: string
  product_id: string
  lot_code: string | null
  quantity_received: number
  quantity_available: number
  unit_cost: string
  location: LocationSummary
  received_at: string
}

export interface AvailableStockResponse {
  product_id: string
  tracking_type: TrackingType
  available_quantity: number
}

export interface StockValuationLine {
  product: ProductSummary
  tracking_type: TrackingType
  quantity_on_hand: number
  total_value: string
}

export interface InventoryMovementItem {
  id: string
  product: ProductSummary
  movement_type: MovementType
  quantity: number | null
  unit_cost: string
  location: LocationSummary
  source_type: MovementSourceType
  source_reference: string | null
  notes: string | null
  created_at: string
}

// --- write payloads ---------------------------------------------------
// location_id is deliberately never sent from any form (F7 design decision
// 2): there is no endpoint to list locations, so every intake/adjustment
// lets the backend auto-resolve to the single active location.

export interface SerialIntakePayload {
  product_id: string
  imei: string
  imei2: string | null
  unit_cost: string
  source_reference: string | null
  notes: string | null
}

export interface BatchIntakePayload {
  product_id: string
  lot_code: string | null
  quantity: number
  unit_cost: string
  source_reference: string | null
  notes: string | null
}

export interface SerialAdjustmentPayload {
  product_id: string
  direction: AdjustmentDirection
  imei: string
  new_status: ProductUnitStatus
  notes: string | null
}

export interface BatchAdjustmentPayload {
  product_id: string
  direction: AdjustmentDirection
  quantity: number
  unit_cost: string | null
  notes: string | null
}

export interface MovementsFilters {
  date_from?: string
  date_to?: string
  product_id?: string
  movement_type?: MovementType
  limit: number
  offset: number
}
