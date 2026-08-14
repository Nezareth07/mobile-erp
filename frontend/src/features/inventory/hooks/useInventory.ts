import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adjustBatchStock,
  adjustSerialStock,
  getAvailableStock,
  getInventoryMovements,
  getProduct,
  getProductUnits,
  getStockValuation,
  listProducts,
  registerBatchIntake,
  registerSerialIntake,
} from '../api'
import type { MovementsQuery } from '../api'
import type {
  BatchAdjustmentPayload,
  BatchIntakePayload,
  ProductUnitStatus,
  SerialAdjustmentPayload,
  SerialIntakePayload,
} from '../types/inventory'

const VALUATION_KEY = ['inventory', 'valuation']
const PRODUCTS_KEY = ['inventory', 'products']

function stockKey(productId: string) {
  return ['inventory', 'stock', productId]
}

function unitsKey(productId: string, status?: ProductUnitStatus) {
  return ['inventory', 'units', productId, status ?? null]
}

function movementsKey(query: MovementsQuery) {
  return [
    'inventory',
    'movements',
    query.range?.dateFrom ?? null,
    query.range?.dateTo ?? null,
    query.productId ?? null,
    query.movementType ?? null,
    query.limit,
    query.offset,
  ]
}

export function useStockValuationQuery() {
  return useQuery({
    queryKey: VALUATION_KEY,
    queryFn: getStockValuation,
  })
}

export function useProductOptionsQuery() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: listProducts,
  })
}

export function useProductQuery(productId: string) {
  return useQuery({
    queryKey: ['inventory', 'product', productId],
    queryFn: () => getProduct(productId),
  })
}

export function useAvailableStockQuery(productId: string) {
  return useQuery({
    queryKey: stockKey(productId),
    queryFn: () => getAvailableStock(productId),
  })
}

export function useProductUnitsQuery(
  productId: string,
  status: ProductUnitStatus | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: unitsKey(productId, status),
    queryFn: () => getProductUnits(productId, status),
    enabled,
  })
}

export function useInventoryMovementsQuery(query: MovementsQuery) {
  return useQuery({
    queryKey: movementsKey(query),
    queryFn: () => getInventoryMovements(query),
  })
}

function useInvalidateProductStock(productId: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: stockKey(productId) })
    queryClient.invalidateQueries({
      queryKey: ['inventory', 'units', productId],
    })
    queryClient.invalidateQueries({ queryKey: VALUATION_KEY })
    queryClient.invalidateQueries({ queryKey: ['inventory', 'movements'] })
  }
}

export function useRegisterSerialIntake(productId: string) {
  const invalidate = useInvalidateProductStock(productId)

  return useMutation({
    mutationFn: (payload: SerialIntakePayload) => registerSerialIntake(payload),
    onSuccess: invalidate,
  })
}

export function useRegisterBatchIntake(productId: string) {
  const invalidate = useInvalidateProductStock(productId)

  return useMutation({
    mutationFn: (payload: BatchIntakePayload) => registerBatchIntake(payload),
    onSuccess: invalidate,
  })
}

export function useAdjustSerialStock(productId: string) {
  const invalidate = useInvalidateProductStock(productId)

  return useMutation({
    mutationFn: (payload: SerialAdjustmentPayload) => adjustSerialStock(payload),
    onSuccess: invalidate,
  })
}

export function useAdjustBatchStock(productId: string) {
  const invalidate = useInvalidateProductStock(productId)

  return useMutation({
    mutationFn: (payload: BatchAdjustmentPayload) => adjustBatchStock(payload),
    onSuccess: invalidate,
  })
}
