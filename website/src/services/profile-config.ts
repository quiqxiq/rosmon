import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { ProfileConfig, ProfileConfigInput } from '@/types/profile-config'

const base = (deviceId: string) => `/devices/${deviceId}/profile-configs`

export const profileConfigService = {
  async list(deviceId: string): Promise<ProfileConfig[]> {
    const { data } = await http.get<ApiEnvelope<ProfileConfig[]>>(base(deviceId))
    return data.data
  },
  async upsert(deviceId: string, payload: ProfileConfigInput): Promise<ProfileConfig> {
    const { data } = await http.put<ApiEnvelope<ProfileConfig>>(base(deviceId), payload)
    return data.data
  },
}
