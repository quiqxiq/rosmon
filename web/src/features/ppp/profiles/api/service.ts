import { apiClient } from '@/lib/api/client'
import type { AddResult, Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  RouterPPPProfile,
  RouterPPPProfileCreateInput,
  RouterPPPProfileUpdateInput,
} from './schema'

const base = (rid: number) => `/devices/${rid}/ppp/profiles`

// GET /ppp/profiles — list RouterOS PPP profiles.
export async function listPPPProfiles(
  routerId: number,
): Promise<RouterPPPProfile[]> {
  const res = await apiClient.get<Envelope<RouterPPPProfile[]>>(base(routerId))
  return unwrap(res.data)
}

// POST /ppp/profiles — create. Returns the new RouterOS `.id`.
export async function addPPPProfile(
  routerId: number,
  payload: RouterPPPProfileCreateInput,
): Promise<AddResult> {
  const res = await apiClient.post<Envelope<AddResult>>(base(routerId), payload)
  return unwrap(res.data)
}

// PUT /ppp/profiles/{id} — sparse update.
export async function updatePPPProfile(
  routerId: number,
  id: string,
  patch: RouterPPPProfileUpdateInput,
): Promise<void> {
  await apiClient.put(`${base(routerId)}/${encodeURIComponent(id)}`, patch)
}

// DELETE /ppp/profiles/{id}.
export async function removePPPProfile(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}
