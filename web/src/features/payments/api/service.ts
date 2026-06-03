import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  Payment,
  PaymentListFilters,
  CreatePaymentInput,
  CollectByCodeInput,
  CollectByCodeResult,
} from './schema'

const base = '/payments'

export async function listPayments(filters?: PaymentListFilters): Promise<Payment[]> {
  const res = await apiClient.get<Envelope<Payment[]>>(base, { params: filters })
  return unwrap(res.data)
}

export async function getPayment(id: number): Promise<Payment> {
  const res = await apiClient.get<Envelope<Payment>>(`${base}/${id}`)
  return unwrap(res.data)
}

export async function createPayment(payload: CreatePaymentInput): Promise<Payment> {
  const res = await apiClient.post<Envelope<Payment>>(base, payload)
  return unwrap(res.data)
}

export async function confirmPayment(id: number): Promise<Payment> {
  const res = await apiClient.post<Envelope<Payment>>(`${base}/${id}/confirm`)
  return unwrap(res.data)
}

export async function rejectPayment(id: number, reason?: string): Promise<Payment> {
  const res = await apiClient.post<Envelope<Payment>>(`${base}/${id}/reject`, {
    reason: reason ?? '',
  })
  return unwrap(res.data)
}

export async function collectByCode(payload: CollectByCodeInput): Promise<CollectByCodeResult> {
  const res = await apiClient.post<Envelope<CollectByCodeResult>>(`${base}/collect`, payload)
  return unwrap(res.data)
}
