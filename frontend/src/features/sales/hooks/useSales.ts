import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSale,
  getAvailableStock,
  getInStockUnits,
  getSale,
  listCustomers,
  listProducts,
  listSales,
} from '../api'
import type { SalesQuery } from '../api'
import type { SaleCreatePayload } from '../types/sale'

const SALES_KEY = ['sales']

function salesListKey(query: SalesQuery) {
  return [...SALES_KEY, query.customerId ?? null, query.limit, query.offset]
}

export function useSalesQuery(query: SalesQuery) {
  return useQuery({
    queryKey: salesListKey(query),
    queryFn: () => listSales(query),
  })
}

export function useSaleQuery(id: string) {
  return useQuery({
    queryKey: [...SALES_KEY, id],
    queryFn: () => getSale(id),
  })
}

export function useCustomerOptionsQuery() {
  return useQuery({
    queryKey: ['sales', 'customers'],
    queryFn: listCustomers,
  })
}

export function useProductOptionsQuery() {
  return useQuery({
    queryKey: ['sales', 'products'],
    queryFn: listProducts,
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SaleCreatePayload) => createSale(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SALES_KEY }),
  })
}

// Auxiliary, read-only, UX-only queries. `enabled` gates them to only fire
// when relevant (a product is selected and its tracking_type is known);
// a 403 here (no inventory.read) simply leaves `data` unset and `isError`
// true -- callers treat that as "auxiliary info unavailable", never as a
// blocker for the sale itself.

export function useAvailableStockQuery(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sales', 'stock', productId],
    queryFn: () => getAvailableStock(productId),
    enabled,
    retry: false,
  })
}

export function useInStockUnitsQuery(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sales', 'units', productId],
    queryFn: () => getInStockUnits(productId),
    enabled,
    retry: false,
  })
}
