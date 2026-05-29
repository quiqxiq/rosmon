import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { HotspotActiveRecord } from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/active`

// GET /hotspot/active — list currently authenticated sessions.
export async function listHotspotActive(
  routerId: number,
): Promise<HotspotActiveRecord[]> {
  const res = await apiClient.get<Envelope<HotspotActiveRecord[]>>(base(routerId))
  return unwrap(res.data)
}

// DELETE /hotspot/active/{id} — drop session WITHOUT removing the cookie,
// so the user can re-authenticate transparently from the captive portal.
export async function removeHotspotActive(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}

// POST /hotspot/active/{id}/disconnect — drop session AND remove cookie,
// forcing a full re-authentication. Use this for kick / lock-out flows.
export async function disconnectHotspotUser(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.post(
    `${base(routerId)}/${encodeURIComponent(id)}/disconnect`,
  )
}
