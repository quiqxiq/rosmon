import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  HotspotDbProfile,
  HotspotDbProfileCreateInput,
  HotspotDbProfileFilters,
  HotspotDbProfileSyncResult,
  HotspotDbProfileUpdateInput,
  HotspotDbProfileWriteResult,
} from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot-profiles`

export async function listHotspotDbProfiles(
  routerId: number,
  filters?: HotspotDbProfileFilters,
): Promise<HotspotDbProfile[]> {
  const res = await apiClient.get<Envelope<HotspotDbProfile[]>>(base(routerId), {
    params: filters,
  })
  return unwrap(res.data)
}

export async function createHotspotDbProfile(
  routerId: number,
  payload: HotspotDbProfileCreateInput,
): Promise<HotspotDbProfileWriteResult> {
  const res = await apiClient.post<Envelope<HotspotDbProfileWriteResult>>(
    base(routerId),
    payload,
  )
  return unwrap(res.data)
}

export async function updateHotspotDbProfile(
  routerId: number,
  id: number,
  payload: HotspotDbProfileUpdateInput,
): Promise<HotspotDbProfileWriteResult> {
  const res = await apiClient.put<Envelope<HotspotDbProfileWriteResult>>(
    `${base(routerId)}/${id}`,
    payload,
  )
  return unwrap(res.data)
}

export async function removeHotspotDbProfile(
  routerId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${id}`)
}

export async function syncHotspotDbProfiles(
  routerId: number,
  role?: string,
): Promise<HotspotDbProfileSyncResult> {
  const res = await apiClient.post<Envelope<HotspotDbProfileSyncResult>>(
    `${base(routerId)}/sync`,
    undefined,
    { params: role ? { role } : undefined },
  )
  return unwrap(res.data)
}
