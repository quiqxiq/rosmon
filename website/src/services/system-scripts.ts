import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { SystemScript } from '@/types/system'

const base = (deviceId: string) => `/devices/${deviceId}/system/scripts`

export const systemScriptsService = {
  async list(deviceId: string): Promise<SystemScript[]> {
    const { data } = await http.get<ApiEnvelope<SystemScript[]>>(base(deviceId))
    return data.data
  },
  async create(deviceId: string, payload: Partial<SystemScript>): Promise<SystemScript> {
    const { data } = await http.post<ApiEnvelope<SystemScript>>(base(deviceId), payload)
    return data.data
  },
}
