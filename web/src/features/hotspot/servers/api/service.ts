import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { HotspotServerRecord } from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/servers`

// GET /hotspot/servers — list configured hotspot server instances.
export async function listHotspotServers(
  routerId: number,
): Promise<HotspotServerRecord[]> {
  const res = await apiClient.get<Envelope<HotspotServerRecord[]>>(base(routerId))
  return unwrap(res.data)
}
