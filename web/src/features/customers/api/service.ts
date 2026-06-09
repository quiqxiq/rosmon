import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  Customer,
  CustomerCreateInput,
  CustomerListFilters,
  CustomerUpdateInput,
} from './schema'

const base = '/customers'

export async function listCustomers(
  filters?: CustomerListFilters,
): Promise<Customer[]> {
  const res = await apiClient.get<Envelope<Customer[]>>(base, {
    params: filters,
  })
  return unwrap(res.data)
}

export async function createCustomer(
  payload: CustomerCreateInput,
): Promise<Customer> {
  const res = await apiClient.post<Envelope<Customer>>(base, payload)
  return unwrap(res.data)
}

export async function updateCustomer(
  id: number,
  payload: CustomerUpdateInput,
): Promise<Customer> {
  const res = await apiClient.put<Envelope<Customer>>(`${base}/${id}`, payload)
  return unwrap(res.data)
}

export async function removeCustomer(id: number): Promise<void> {
  await apiClient.delete(`${base}/${id}`)
}

// revealPortalPassword & resetPortalPassword — admin/operator only (backend
// gated). Mengembalikan password portal plaintext.
export async function revealPortalPassword(id: number): Promise<string> {
  const res = await apiClient.get<Envelope<{ password: string }>>(
    `${base}/${id}/portal-password`,
  )
  return unwrap(res.data).password
}

export async function resetPortalPassword(id: number): Promise<string> {
  const res = await apiClient.post<Envelope<{ password: string }>>(
    `${base}/${id}/portal-password/reset`,
  )
  return unwrap(res.data).password
}
