import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  PPPActive,
  PPPProfile,
  PPPProfileCreateInput,
  PPPProfileUpdateInput,
  PPPSecret,
  PPPSecretCreateInput,
  PPPSecretUpdateInput,
} from '@/types/ppp'

const base = (deviceId: string) => `/devices/${deviceId}/ppp`

export const pppService = {
  // ── Secrets ────────────────────────────────────────────────────────────
  async listSecrets(deviceId: string): Promise<PPPSecret[]> {
    const { data } = await http.get<ApiEnvelope<PPPSecret[]>>(`${base(deviceId)}/secrets`)
    return data.data
  },
  async createSecret(deviceId: string, payload: PPPSecretCreateInput): Promise<PPPSecret> {
    const { data } = await http.post<ApiEnvelope<PPPSecret>>(`${base(deviceId)}/secrets`, payload)
    return data.data
  },
  async updateSecret(
    deviceId: string,
    id: string,
    payload: PPPSecretUpdateInput,
  ): Promise<PPPSecret> {
    const { data } = await http.put<ApiEnvelope<PPPSecret>>(
      `${base(deviceId)}/secrets/${id}`,
      payload,
    )
    return data.data
  },
  async removeSecret(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/secrets/${id}`)
  },

  // ── Profiles ───────────────────────────────────────────────────────────
  async listProfiles(deviceId: string): Promise<PPPProfile[]> {
    const { data } = await http.get<ApiEnvelope<PPPProfile[]>>(`${base(deviceId)}/profiles`)
    return data.data
  },
  async getProfile(deviceId: string, id: string): Promise<PPPProfile> {
    const { data } = await http.get<ApiEnvelope<PPPProfile>>(`${base(deviceId)}/profiles/${id}`)
    return data.data
  },
  async createProfile(deviceId: string, payload: PPPProfileCreateInput): Promise<PPPProfile> {
    const { data } = await http.post<ApiEnvelope<PPPProfile>>(`${base(deviceId)}/profiles`, payload)
    return data.data
  },
  async updateProfile(
    deviceId: string,
    id: string,
    payload: PPPProfileUpdateInput,
  ): Promise<PPPProfile> {
    const { data } = await http.put<ApiEnvelope<PPPProfile>>(
      `${base(deviceId)}/profiles/${id}`,
      payload,
    )
    return data.data
  },
  async removeProfile(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/profiles/${id}`)
  },

  // ── Active ─────────────────────────────────────────────────────────────
  async listActive(deviceId: string): Promise<PPPActive[]> {
    const { data } = await http.get<ApiEnvelope<PPPActive[]>>(`${base(deviceId)}/active`)
    return data.data
  },
}
