import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { HotspotCookieRecord } from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/cookies`

// GET /hotspot/cookies — list remembered hotspot login cookies.
export async function listHotspotCookies(
  routerId: number,
): Promise<HotspotCookieRecord[]> {
  const res = await apiClient.get<Envelope<HotspotCookieRecord[]>>(base(routerId))
  return unwrap(res.data)
}

// DELETE /hotspot/cookies/{id} — drop a single cookie. The user will be
// prompted to re-authenticate on their next request.
export async function removeHotspotCookie(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}
