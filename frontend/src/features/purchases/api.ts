import { api } from '../../lib/api'
import type {
  Purchase,
  PurchaseCreatePayload,
  ProductRef,
  SupplierRef,
} from './types/purchase'

// Not imported from features/suppliers/api.ts or features/catalog/api.ts
// (closed phases) -- see errors.ts for the per-feature isolation
// precedent. Only the fields this module needs are requested here.
export async function listSuppliers(): Promise<SupplierRef[]> {
  const response = await api.get<SupplierRef[]>('/suppliers')
  return response.data
}

export async function listProducts(): Promise<ProductRef[]> {
  const response = await api.get<ProductRef[]>('/products')
  return response.data
}

export interface PurchasesQuery {
  supplierId?: string
  limit: number
  offset: number
}

export async function listPurchases(
  query: PurchasesQuery,
): Promise<Purchase[]> {
  const response = await api.get<Purchase[]>('/purchases', {
    params: {
      supplier_id: query.supplierId,
      limit: query.limit,
      offset: query.offset,
    },
  })
  return response.data
}

export async function getPurchase(id: string): Promise<Purchase> {
  const response = await api.get<Purchase>(`/purchases/${id}`)
  return response.data
}

export async function createPurchase(
  payload: PurchaseCreatePayload,
): Promise<Purchase> {
  const response = await api.post<Purchase>('/purchases', payload)
  return response.data
}
