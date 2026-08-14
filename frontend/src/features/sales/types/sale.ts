// Mirrors backend/app/modules/sale/schemas/sale_*.py field-by-field.
// Decimal fields (unit_price, unit_cost, subtotal, total_amount,
// total_cost, profit) are strings on the wire, same contract already
// confirmed across Dashboard/Catalog/Inventory/Purchases.

export type SaleStatus = 'confirmed' | 'cancelled'

export type TrackingType = 'none' | 'serial' | 'batch'

export interface CustomerRef {
  id: string
  name: string
}

export interface ProductRef {
  id: string
  name: string
  sku: string
  tracking_type: TrackingType
  sale_price: string
}

export interface LocationSummary {
  id: string
  name: string
  type: 'store' | 'warehouse' | 'online'
}

export interface SaleLine {
  id: string
  product: { id: string; name: string; sku: string }
  quantity: number
  unit_price: string
  unit_cost: string
  subtotal: string
  imei: string | null
}

export interface Sale {
  id: string
  customer: CustomerRef
  location: LocationSummary
  status: SaleStatus
  sale_date: string
  total_amount: string
  total_cost: string
  profit: string
  notes: string | null
  lines: SaleLine[]
  created_at: string
  updated_at: string
}

export interface SaleLineCreatePayload {
  product_id: string
  quantity: number
  unit_price: string | null
  imei: string | null
}

export interface SaleCreatePayload {
  customer_id: string | null
  sale_date: string | null
  notes: string | null
  lines: SaleLineCreatePayload[]
}

// --- inventory read-only auxiliary data (UX only, never written to) ---

export type ProductUnitStatus =
  | 'in_stock'
  | 'reserved'
  | 'sold'
  | 'in_warranty'
  | 'defective'
  | 'returned_to_supplier'

export interface AvailableProductUnit {
  id: string
  product_id: string
  imei: string
  imei2: string | null
  status: ProductUnitStatus
}

export interface AvailableStock {
  product_id: string
  tracking_type: TrackingType
  available_quantity: number
}
