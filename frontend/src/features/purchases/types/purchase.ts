// Mirrors backend/app/modules/purchase/schemas/purchase_*.py field-by-field.
// Decimal fields (unit_cost, subtotal, total_cost) are strings on the wire,
// same contract already confirmed across Dashboard/Catalog/Inventory.

export type PurchaseStatus = 'confirmed' | 'cancelled'

export type TrackingType = 'none' | 'serial' | 'batch'

export interface SupplierRef {
  id: string
  name: string
}

export interface ProductRef {
  id: string
  name: string
  sku: string
  tracking_type: TrackingType
}

export interface LocationSummary {
  id: string
  name: string
  type: 'store' | 'warehouse' | 'online'
}

export interface PurchaseLine {
  id: string
  product: { id: string; name: string; sku: string }
  quantity: number
  unit_cost: string
  subtotal: string
  imei: string | null
  imei2: string | null
  lot_code: string | null
}

export interface Purchase {
  id: string
  supplier: SupplierRef
  location: LocationSummary
  status: PurchaseStatus
  invoice_number: string | null
  purchase_date: string
  total_cost: string
  notes: string | null
  lines: PurchaseLine[]
  created_at: string
  updated_at: string
}

export interface PurchaseLineCreatePayload {
  product_id: string
  quantity: number
  unit_cost: string
  imei: string | null
  imei2: string | null
  lot_code: string | null
}

export interface PurchaseCreatePayload {
  supplier_id: string
  invoice_number: string | null
  purchase_date: string | null
  notes: string | null
  lines: PurchaseLineCreatePayload[]
}
