import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { HotspotHostRecord } from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/hosts`

// GET /hotspot/hosts — list host learning entries.
export async function listHotspotHosts(
  routerId: number,
): Promise<HotspotHostRecord[]> {
  const res = await apiClient.get<Envelope<HotspotHostRecord[]>>(base(routerId))
  return unwrap(res.data)
}

// DELETE /hotspot/hosts/{id} — forget host (next packet will re-learn).
export async function removeHotspotHost(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}
