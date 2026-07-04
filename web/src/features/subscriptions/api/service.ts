import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  Subscription,
  SubscriptionCreateInput,
  SubscriptionEnrichedItem,
  SubscriptionListFilters,
  SubscriptionUpdateInput,
  SubscriptionWriteResult,
} from './schema'

const base = '/subscriptions'

export async function listSubscriptions(
  filters?: SubscriptionListFilters
): Promise<Subscription[]> {
  const res = await apiClient.get<Envelope<Subscription[]>>(base, {
    params: filters,
  })
  return unwrap(res.data)
}

export async function createSubscription(
  payload: SubscriptionCreateInput
): Promise<SubscriptionWriteResult> {
  const res = await apiClient.post<Envelope<SubscriptionWriteResult>>(
    base,
    payload
  )
  return unwrap(res.data)
}

export async function updateSubscription(
  id: number,
  payload: SubscriptionUpdateInput
): Promise<SubscriptionWriteResult> {
  const res = await apiClient.put<Envelope<SubscriptionWriteResult>>(
    `${base}/${id}`,
    payload
  )
  return unwrap(res.data)
}

export async function patchSubscriptionStatus(
  id: number,
  status: string
): Promise<SubscriptionWriteResult> {
  const res = await apiClient.patch<Envelope<SubscriptionWriteResult>>(
    `${base}/${id}/status`,
    { status }
  )
  return unwrap(res.data)
}

export async function reconcileSubscription(
  id: number
): Promise<SubscriptionWriteResult> {
  const res = await apiClient.post<Envelope<SubscriptionWriteResult>>(
    `${base}/${id}/reconcile`
  )
  return unwrap(res.data)
}

export async function removeSubscription(id: number): Promise<void> {
  await apiClient.delete(`${base}/${id}`)
}

// revealSubscriptionPassword — admin/operator only (backend gated). Password
// MikroTik (PPPoE/hotspot) plaintext, didekripsi dari DB.
export async function revealSubscriptionPassword(id: number): Promise<string> {
  const res = await apiClient.get<Envelope<{ password: string }>>(
    `${base}/${id}/password`
  )
  return unwrap(res.data).password
}

export async function listSubscriptionsByDevice(
  deviceId: number
): Promise<SubscriptionEnrichedItem[]> {
  const res = await apiClient.get<Envelope<SubscriptionEnrichedItem[]>>(
    `/devices/${deviceId}/subscriptions`
  )
  return unwrap(res.data)
}
