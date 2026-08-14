// Mirrors backend/app/modules/customer/schemas/customer_*.py field-by-field.

export interface Customer {
  id: string
  name: string
  document_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  is_default_customer: boolean
  created_at: string
  updated_at: string
}

export interface CustomerCreatePayload {
  name: string
  document_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

export type CustomerUpdatePayload = Partial<CustomerCreatePayload>
