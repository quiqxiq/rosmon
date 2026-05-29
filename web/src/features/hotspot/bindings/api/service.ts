import { apiClient } from '@/lib/api/client'
import type { AddResult, Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { IPBindingMutation, IPBindingRecord } from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/bindings`

// GET /hotspot/bindings — list IP bindings.
export async function listIPBindings(
  routerId: number,
): Promise<IPBindingRecord[]> {
  const res = await apiClient.get<Envelope<IPBindingRecord[]>>(base(routerId))
  return unwrap(res.data)
}

// POST /hotspot/bindings — create a binding.
export async function addIPBinding(
  routerId: number,
  payload: IPBindingMutation,
): Promise<AddResult> {
  const res = await apiClient.post<Envelope<AddResult>>(base(routerId), payload)
  return unwrap(res.data)
}

// PUT /hotspot/bindings/{id} — partial update.
export async function updateIPBinding(
  routerId: number,
  id: string,
  patch: IPBindingMutation,
): Promise<void> {
  await apiClient.put(`${base(routerId)}/${encodeURIComponent(id)}`, patch)
}

// DELETE /hotspot/bindings/{id} — cascade-cleans queue / scheduler / ARP / lease.
export async function removeIPBinding(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}

// POST /hotspot/bindings/{id}/enable — enable a disabled binding.
export async function enableIPBinding(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.post(`${base(routerId)}/${encodeURIComponent(id)}/enable`)
}

// POST /hotspot/bindings/{id}/disable — disable without removing.
export async function disableIPBinding(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.post(`${base(routerId)}/${encodeURIComponent(id)}/disable`)
}
