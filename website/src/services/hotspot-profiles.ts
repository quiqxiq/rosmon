import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  HotspotProfile,
  HotspotProfileCreateInput,
  HotspotProfileUpdateInput,
} from '@/types/hotspot'

const base = (deviceId: string) => `/devices/${deviceId}/hotspot/profiles`

export const hotspotProfilesService = {
  async list(deviceId: string): Promise<HotspotProfile[]> {
    const { data } = await http.get<ApiEnvelope<HotspotProfile[]>>(base(deviceId))
    return data.data
  },
  async create(deviceId: string, payload: HotspotProfileCreateInput): Promise<HotspotProfile> {
    const { data } = await http.post<ApiEnvelope<HotspotProfile>>(base(deviceId), payload)
    return data.data
  },
  async update(
    deviceId: string,
    id: string,
    payload: HotspotProfileUpdateInput,
  ): Promise<HotspotProfile> {
    const { data } = await http.put<ApiEnvelope<HotspotProfile>>(
      `${base(deviceId)}/${id}`,
      payload,
    )
    return data.data
  },
  async remove(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/${id}`)
  },
}
