import { api } from '../../lib/api'
import type {
  Supplier,
  SupplierCreatePayload,
  SupplierUpdatePayload,
} from './types/supplier'

export async function listSuppliers(): Promise<Supplier[]> {
  const response = await api.get<Supplier[]>('/suppliers')
  return response.data
}

export async function createSupplier(
  payload: SupplierCreatePayload,
): Promise<Supplier> {
  const response = await api.post<Supplier>('/suppliers', payload)
  return response.data
}

export async function updateSupplier(
  id: string,
  payload: SupplierUpdatePayload,
): Promise<Supplier> {
  const response = await api.put<Supplier>(`/suppliers/${id}`, payload)
  return response.data
}

export async function deleteSupplier(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`)
}
