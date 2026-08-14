import { api } from '../../lib/api'
import { toExclusiveDateParams } from './dateRange'
import type { DateRange } from './dateRange'
import type {
  AvailableStockResponse,
  BatchAdjustmentPayload,
  BatchIntakePayload,
  InventoryMovementItem,
  ProductRef,
  ProductUnitResponse,
  ProductUnitStatus,
  SerialAdjustmentPayload,
  SerialIntakePayload,
  StockLotResponse,
  StockValuationLine,
} from './types/inventory'

// Not imported from features/catalog/api.ts (closed phase F5) -- see
// errors.ts for the per-feature isolation precedent. Only the fields this
// module needs (ProductRef) are requested here.
export async function getProduct(productId: string): Promise<ProductRef> {
  const response = await api.get<ProductRef>(`/products/${productId}`)
  return response.data
}

export async function listProducts(): Promise<ProductRef[]> {
  const response = await api.get<ProductRef[]>('/products')
  return response.data
}

export async function getStockValuation(): Promise<StockValuationLine[]> {
  const response = await api.get<StockValuationLine[]>(
    '/reports/inventory/valuation',
  )
  return response.data
}

export interface MovementsQuery {
  range?: DateRange
  productId?: string
  movementType?: string
  limit: number
  offset: number
}

export async function getInventoryMovements(
  query: MovementsQuery,
): Promise<InventoryMovementItem[]> {
  const response = await api.get<InventoryMovementItem[]>(
    '/reports/inventory/movements',
    {
      params: {
        ...(query.range ? toExclusiveDateParams(query.range) : {}),
        product_id: query.productId,
        movement_type: query.movementType,
        limit: query.limit,
        offset: query.offset,
      },
    },
  )
  return response.data
}

export async function getAvailableStock(
  productId: string,
): Promise<AvailableStockResponse> {
  const response = await api.get<AvailableStockResponse>(
    `/inventory/products/${productId}/stock`,
  )
  return response.data
}

export async function getProductUnits(
  productId: string,
  status?: ProductUnitStatus,
): Promise<ProductUnitResponse[]> {
  const response = await api.get<ProductUnitResponse[]>(
    `/inventory/products/${productId}/units`,
    { params: status ? { status } : undefined },
  )
  return response.data
}

export async function getUnitByImei(
  imei: string,
): Promise<ProductUnitResponse> {
  const response = await api.get<ProductUnitResponse>(
    `/inventory/units/by-imei/${encodeURIComponent(imei)}`,
  )
  return response.data
}

export async function registerSerialIntake(
  payload: SerialIntakePayload,
): Promise<ProductUnitResponse> {
  const response = await api.post<ProductUnitResponse>(
    '/inventory/intake/serial',
    payload,
  )
  return response.data
}

export async function registerBatchIntake(
  payload: BatchIntakePayload,
): Promise<StockLotResponse> {
  const response = await api.post<StockLotResponse>(
    '/inventory/intake/batch',
    payload,
  )
  return response.data
}

export async function adjustSerialStock(
  payload: SerialAdjustmentPayload,
): Promise<AvailableStockResponse> {
  const response = await api.post<AvailableStockResponse>(
    '/inventory/adjustments',
    payload,
  )
  return response.data
}

export async function adjustBatchStock(
  payload: BatchAdjustmentPayload,
): Promise<AvailableStockResponse> {
  const response = await api.post<AvailableStockResponse>(
    '/inventory/adjustments',
    payload,
  )
  return response.data
}
