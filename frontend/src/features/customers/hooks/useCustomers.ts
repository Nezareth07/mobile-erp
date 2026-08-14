import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  setDefaultCustomer,
  updateCustomer,
} from '../api'
import type {
  CustomerCreatePayload,
  CustomerUpdatePayload,
} from '../types/customer'

const CUSTOMERS_KEY = ['customers']

export function useCustomersQuery() {
  return useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: listCustomers,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CustomerCreatePayload) => createCustomer(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: CustomerUpdatePayload
    }) => updateCustomer(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}

export function useSetDefaultCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => setDefaultCustomer(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_KEY }),
  })
}
