import { api } from '../../lib/api'
import type {
  Customer,
  CustomerCreatePayload,
  CustomerUpdatePayload,
} from './types/customer'

export async function listCustomers(): Promise<Customer[]> {
  const response = await api.get<Customer[]>('/customers')
  return response.data
}

export async function createCustomer(
  payload: CustomerCreatePayload,
): Promise<Customer> {
  const response = await api.post<Customer>('/customers', payload)
  return response.data
}

export async function updateCustomer(
  id: string,
  payload: CustomerUpdatePayload,
): Promise<Customer> {
  const response = await api.put<Customer>(`/customers/${id}`, payload)
  return response.data
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}`)
}

export async function setDefaultCustomer(id: string): Promise<Customer> {
  const response = await api.put<Customer>(`/customers/${id}/default`)
  return response.data
}
