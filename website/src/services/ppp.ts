import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { PPPActive, PPPProfile, PPPSecret } from '@/types/ppp'

const base = (deviceId: string) => `/devices/${deviceId}/ppp`

export const pppService = {
  async listSecrets(deviceId: string): Promise<PPPSecret[]> {
    const { data } = await http.get<ApiEnvelope<PPPSecret[]>>(`${base(deviceId)}/secrets`)
    return data.data
  },
  async createSecret(deviceId: string, payload: Partial<PPPSecret>): Promise<PPPSecret> {
    const { data } = await http.post<ApiEnvelope<PPPSecret>>(`${base(deviceId)}/secrets`, payload)
    return data.data
  },
  async updateSecret(
    deviceId: string,
    id: string,
    payload: Partial<PPPSecret>,
  ): Promise<PPPSecret> {
    const { data } = await http.patch<ApiEnvelope<PPPSecret>>(
      `${base(deviceId)}/secrets/${id}`,
      payload,
    )
    return data.data
  },
  async removeSecret(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/secrets/${id}`)
  },
  async listProfiles(deviceId: string): Promise<PPPProfile[]> {
    const { data } = await http.get<ApiEnvelope<PPPProfile[]>>(`${base(deviceId)}/profiles`)
    return data.data
  },
  async listActive(deviceId: string): Promise<PPPActive[]> {
    const { data } = await http.get<ApiEnvelope<PPPActive[]>>(`${base(deviceId)}/active`)
    return data.data
  },
}
