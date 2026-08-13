// Mirrors backend/app/modules/supplier/schemas/supplier_*.py field-by-field.

export interface Supplier {
  id: string
  name: string
  tax_id: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierCreatePayload {
  name: string
  tax_id: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export type SupplierUpdatePayload = Partial<SupplierCreatePayload>
