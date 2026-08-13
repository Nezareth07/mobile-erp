import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from '../api'
import type {
  SupplierCreatePayload,
  SupplierUpdatePayload,
} from '../types/supplier'

const SUPPLIERS_KEY = ['suppliers']

export function useSuppliersQuery() {
  return useQuery({
    queryKey: SUPPLIERS_KEY,
    queryFn: listSuppliers,
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SupplierCreatePayload) => createSupplier(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: SupplierUpdatePayload
    }) => updateSupplier(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  })
}
