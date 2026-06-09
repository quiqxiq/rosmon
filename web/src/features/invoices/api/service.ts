import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { Invoice, InvoiceListFilters, GenerateInvoiceInput } from './schema'

const base = '/invoices'

export async function listInvoices(filters?: InvoiceListFilters): Promise<Invoice[]> {
  const res = await apiClient.get<Envelope<Invoice[]>>(base, { params: filters })
  return unwrap(res.data)
}

export async function getInvoice(id: number): Promise<Invoice> {
  const res = await apiClient.get<Envelope<Invoice>>(`${base}/${id}`)
  return unwrap(res.data)
}

export async function generateInvoice(payload: GenerateInvoiceInput): Promise<Invoice> {
  const res = await apiClient.post<Envelope<Invoice>>(`${base}/generate`, payload)
  return unwrap(res.data)
}

export async function cancelInvoice(id: number): Promise<Invoice> {
  const res = await apiClient.post<Envelope<Invoice>>(`${base}/${id}/cancel`)
  return unwrap(res.data)
}
