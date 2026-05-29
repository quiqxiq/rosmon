import { apiClient } from '@/lib/api/client'
import type { CountResponse, Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { InactiveUserRecord } from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/inactive`

// GET /hotspot/inactive — users without an active session right now.
// Backend cross-references /hotspot/users vs /hotspot/active.
export async function listInactiveHotspotUsers(
  routerId: number,
): Promise<InactiveUserRecord[]> {
  const res = await apiClient.get<Envelope<InactiveUserRecord[]>>(base(routerId))
  return unwrap(res.data)
}

// GET /hotspot/inactive/count — count without paying the list cost.
export async function getInactiveHotspotUserCount(
  routerId: number,
): Promise<number> {
  const res = await apiClient.get<Envelope<CountResponse>>(
    `${base(routerId)}/count`,
  )
  return unwrap(res.data).count
}
