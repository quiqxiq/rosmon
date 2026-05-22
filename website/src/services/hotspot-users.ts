import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { HotspotUser } from '@/types/hotspot'

const base = (deviceId: string) => `/devices/${deviceId}/hotspot/users`

export const hotspotUsersService = {
  async list(deviceId: string): Promise<HotspotUser[]> {
    const { data } = await http.get<ApiEnvelope<HotspotUser[]>>(base(deviceId))
    return data.data
  },
  async get(deviceId: string, id: string): Promise<HotspotUser> {
    const { data } = await http.get<ApiEnvelope<HotspotUser>>(`${base(deviceId)}/${id}`)
    return data.data
  },
  async create(deviceId: string, payload: Partial<HotspotUser>): Promise<HotspotUser> {
    const { data } = await http.post<ApiEnvelope<HotspotUser>>(base(deviceId), payload)
    return data.data
  },
  async update(deviceId: string, id: string, payload: Partial<HotspotUser>): Promise<HotspotUser> {
    const { data } = await http.patch<ApiEnvelope<HotspotUser>>(`${base(deviceId)}/${id}`, payload)
    return data.data
  },
  async remove(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/${id}`)
  },
  async bulkRemove(deviceId: string, ids: string[]): Promise<void> {
    await http.post(`${base(deviceId)}/bulk-delete`, { ids })
  },
  async resetCounters(deviceId: string, id: string): Promise<void> {
    await http.post(`${base(deviceId)}/${id}/reset-counters`)
  },
}
