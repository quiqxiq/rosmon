import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  PPPProfileDB,
  PPPProfileDBCreateInput,
  PPPProfileDBSyncResponse,
  PPPProfileDBUpdateInput,
  PPPProfileDBWriteResponse,
} from '@/types/ppp-profile-db'

const base = (deviceId: string) => `/devices/${deviceId}/ppp-profiles`

function normalizeWrite(raw: unknown): PPPProfileDBWriteResponse {
  const r = raw as Partial<PPPProfileDBWriteResponse> & Partial<PPPProfileDB>
  if (r && 'profile' in r && r.profile) {
    return { profile: r.profile, warning: r.warning }
  }
  return { profile: r as PPPProfileDB }
}

export const pppProfilesDBService = {
  async list(deviceId: string): Promise<PPPProfileDB[]> {
    const { data } = await http.get<ApiEnvelope<PPPProfileDB[]>>(base(deviceId))
    return data.data
  },

  async get(deviceId: string, id: number): Promise<PPPProfileDB> {
    const { data } = await http.get<ApiEnvelope<PPPProfileDB>>(`${base(deviceId)}/${id}`)
    return data.data
  },

  async create(deviceId: string, input: PPPProfileDBCreateInput): Promise<PPPProfileDBWriteResponse> {
    const { data } = await http.post<ApiEnvelope<unknown>>(base(deviceId), input)
    return normalizeWrite(data.data)
  },

  async update(
    deviceId: string,
    id: number,
    input: PPPProfileDBUpdateInput,
  ): Promise<PPPProfileDBWriteResponse> {
    const { data } = await http.put<ApiEnvelope<unknown>>(`${base(deviceId)}/${id}`, input)
    return normalizeWrite(data.data)
  },

  async remove(deviceId: string, id: number): Promise<PPPProfileDBWriteResponse | null> {
    const { data, status } = await http.delete<ApiEnvelope<unknown>>(`${base(deviceId)}/${id}`)
    if (status === 204) return null
    return normalizeWrite(data?.data)
  },

  async sync(deviceId: string): Promise<PPPProfileDBSyncResponse> {
    const { data } = await http.post<ApiEnvelope<PPPProfileDBSyncResponse>>(
      `${base(deviceId)}/sync`,
    )
    return data.data
  },
}
