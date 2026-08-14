import { api } from '../../lib/api'
import type {
  AvailableProductUnit,
  AvailableStock,
  CustomerRef,
  ProductRef,
  Sale,
  SaleCreatePayload,
} from './types/sale'

// Not imported from features/customers/api.ts or features/catalog/api.ts
// (closed phases) -- see errors.ts for the per-feature isolation
// precedent. Only the fields this module needs are requested here.
export async function listCustomers(): Promise<CustomerRef[]> {
  const response = await api.get<CustomerRef[]>('/customers')
  return response.data
}

export async function listProducts(): Promise<ProductRef[]> {
  const response = await api.get<ProductRef[]>('/products')
  return response.data
}

export interface SalesQuery {
  customerId?: string
  limit: number
  offset: number
}

export async function listSales(query: SalesQuery): Promise<Sale[]> {
  const response = await api.get<Sale[]>('/sales', {
    params: {
      customer_id: query.customerId,
      limit: query.limit,
      offset: query.offset,
    },
  })
  return response.data
}

export async function getSale(id: string): Promise<Sale> {
  const response = await api.get<Sale>(`/sales/${id}`)
  return response.data
}

export async function createSale(payload: SaleCreatePayload): Promise<Sale> {
  const response = await api.post<Sale>('/sales', payload)
  return response.data
}

// --- inventory read-only auxiliary data (UX only) ----------------------
// Never used to write stock/movements -- POST /sales is the only write
// endpoint this feature calls. These two exist already (built in F7) and
// are queried here purely to help the seller pick a valid IMEI / see
// available quantity; SaleService remains the sole authority that
// validates and enforces stock on the backend.

export async function getAvailableStock(
  productId: string,
): Promise<AvailableStock> {
  const response = await api.get<AvailableStock>(
    `/inventory/products/${productId}/stock`,
  )
  return response.data
}

export async function getInStockUnits(
  productId: string,
): Promise<AvailableProductUnit[]> {
  const response = await api.get<AvailableProductUnit[]>(
    `/inventory/products/${productId}/units`,
    { params: { status: 'in_stock' } },
  )
  return response.data
}
