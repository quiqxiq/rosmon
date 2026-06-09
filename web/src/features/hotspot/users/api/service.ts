import { apiClient } from '@/lib/api/client'
import type { AddResult, CountResponse, Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  HotspotUserListFilters,
  HotspotUserMutation,
  HotspotUserRecord,
} from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/users`

// GET /hotspot/users — list users (optionally filtered by profile).
export async function listHotspotUsers(
  routerId: number,
  filters?: HotspotUserListFilters,
): Promise<HotspotUserRecord[]> {
  const res = await apiClient.get<Envelope<HotspotUserRecord[]>>(base(routerId), {
    params: filters,
  })
  return unwrap(res.data)
}

// GET /hotspot/users/count — total (or per-profile) user count.
export async function getHotspotUserCount(
  routerId: number,
  profile?: string,
): Promise<number> {
  const res = await apiClient.get<Envelope<CountResponse>>(
    `${base(routerId)}/count`,
    { params: profile ? { profile } : undefined },
  )
  return unwrap(res.data).count
}

// GET /hotspot/users/export — CSV blob (one row per user). Not a hook —
// the UI calls this directly to trigger a download.
export async function exportHotspotUsersCSV(
  routerId: number,
  profile?: string,
): Promise<Blob> {
  const res = await apiClient.get<Blob>(`${base(routerId)}/export`, {
    params: profile ? { profile } : undefined,
    responseType: 'blob',
  })
  return res.data
}

// GET /hotspot/users/{id} — single user. `id` may be RouterOS `.id` or name.
export async function getHotspotUser(
  routerId: number,
  id: string,
): Promise<HotspotUserRecord> {
  const res = await apiClient.get<Envelope<HotspotUserRecord>>(
    `${base(routerId)}/${encodeURIComponent(id)}`,
  )
  return unwrap(res.data)
}

// POST /hotspot/users — create. Returns the new RouterOS `.id`.
export async function addHotspotUser(
  routerId: number,
  payload: HotspotUserMutation,
): Promise<AddResult> {
  const res = await apiClient.post<Envelope<AddResult>>(base(routerId), payload)
  return unwrap(res.data)
}

// PUT /hotspot/users/{id} — partial update.
export async function updateHotspotUser(
  routerId: number,
  id: string,
  patch: HotspotUserMutation,
): Promise<void> {
  await apiClient.put(`${base(routerId)}/${encodeURIComponent(id)}`, patch)
}

// DELETE /hotspot/users/{id} — cascade-cleans related schedulers/scripts.
export async function removeHotspotUser(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}

// POST /hotspot/users/{id}/reset-counters — reset bytes-in / bytes-out.
export async function resetHotspotUserCounters(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.post(
    `${base(routerId)}/${encodeURIComponent(id)}/reset-counters`,
  )
}

// GET /hotspot/users/{id}/password — admin/operator only (backend gated).
export async function revealHotspotUserPassword(
  routerId: number,
  id: string,
): Promise<string> {
  const res = await apiClient.get<Envelope<{ password: string }>>(
    `${base(routerId)}/${encodeURIComponent(id)}/password`,
  )
  return unwrap(res.data).password
}
