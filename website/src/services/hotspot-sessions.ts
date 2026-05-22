import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { HotspotBinding, HotspotHost, HotspotSession } from '@/types/hotspot'

const base = (deviceId: string) => `/devices/${deviceId}/hotspot`

export const hotspotSessionsService = {
  async listActive(deviceId: string): Promise<HotspotSession[]> {
    const { data } = await http.get<ApiEnvelope<HotspotSession[]>>(`${base(deviceId)}/active`)
    return data.data
  },
  async listHosts(deviceId: string): Promise<HotspotHost[]> {
    const { data } = await http.get<ApiEnvelope<HotspotHost[]>>(`${base(deviceId)}/hosts`)
    return data.data
  },
  async listBindings(deviceId: string): Promise<HotspotBinding[]> {
    const { data } = await http.get<ApiEnvelope<HotspotBinding[]>>(`${base(deviceId)}/bindings`)
    return data.data
  },
  async disconnectActive(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/active/${id}`)
  },
}
