import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPurchase,
  getPurchase,
  listProducts,
  listPurchases,
  listSuppliers,
} from '../api'
import type { PurchasesQuery } from '../api'
import type { PurchaseCreatePayload } from '../types/purchase'

const PURCHASES_KEY = ['purchases']

function purchasesListKey(query: PurchasesQuery) {
  return [...PURCHASES_KEY, query.supplierId ?? null, query.limit, query.offset]
}

export function usePurchasesQuery(query: PurchasesQuery) {
  return useQuery({
    queryKey: purchasesListKey(query),
    queryFn: () => listPurchases(query),
  })
}

export function usePurchaseQuery(id: string) {
  return useQuery({
    queryKey: [...PURCHASES_KEY, id],
    queryFn: () => getPurchase(id),
  })
}

export function useSupplierOptionsQuery() {
  return useQuery({
    queryKey: ['purchases', 'suppliers'],
    queryFn: listSuppliers,
  })
}

export function useProductOptionsQuery() {
  return useQuery({
    queryKey: ['purchases', 'products'],
    queryFn: listProducts,
  })
}

export function useCreatePurchase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: PurchaseCreatePayload) => createPurchase(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PURCHASES_KEY }),
  })
}
