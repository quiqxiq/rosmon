import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  HotspotProfileDB,
  HotspotProfileDBCreateInput,
  HotspotProfileDBListFilter,
  HotspotProfileDBSyncResponse,
  HotspotProfileDBUpdateInput,
  HotspotProfileDBWriteResponse,
} from '@/types/hotspot-profile-db'

const base = (deviceId: string) => `/devices/${deviceId}/hotspot-profiles`

function normalizeWrite(raw: unknown): HotspotProfileDBWriteResponse {
  const r = raw as Partial<HotspotProfileDBWriteResponse> & Partial<HotspotProfileDB>
  if (r && 'profile' in r && r.profile) {
    return { profile: r.profile, warning: r.warning }
  }
  return { profile: r as HotspotProfileDB }
}

export const hotspotProfilesDBService = {
  async list(deviceId: string, filter: HotspotProfileDBListFilter = {}): Promise<HotspotProfileDB[]> {
    const params = new URLSearchParams()
    if (filter.role) params.set('role', filter.role)
    if (filter.only_active) params.set('only_active', 'true')
    const qs = params.toString()
    const url = qs ? `${base(deviceId)}?${qs}` : base(deviceId)
    const { data } = await http.get<ApiEnvelope<HotspotProfileDB[]>>(url)
    return data.data
  },

  async get(deviceId: string, id: number): Promise<HotspotProfileDB> {
    const { data } = await http.get<ApiEnvelope<HotspotProfileDB>>(`${base(deviceId)}/${id}`)
    return data.data
  },

  async create(
    deviceId: string,
    input: HotspotProfileDBCreateInput,
  ): Promise<HotspotProfileDBWriteResponse> {
    const { data } = await http.post<ApiEnvelope<unknown>>(base(deviceId), input)
    return normalizeWrite(data.data)
  },

  async update(
    deviceId: string,
    id: number,
    input: HotspotProfileDBUpdateInput,
  ): Promise<HotspotProfileDBWriteResponse> {
    const { data } = await http.put<ApiEnvelope<unknown>>(`${base(deviceId)}/${id}`, input)
    return normalizeWrite(data.data)
  },

  async remove(deviceId: string, id: number): Promise<HotspotProfileDBWriteResponse | null> {
    const { data, status } = await http.delete<ApiEnvelope<unknown>>(`${base(deviceId)}/${id}`)
    if (status === 204) return null
    return normalizeWrite(data?.data)
  },

  async sync(deviceId: string, role?: string): Promise<HotspotProfileDBSyncResponse> {
    const url = role ? `${base(deviceId)}/sync?role=${role}` : `${base(deviceId)}/sync`
    const { data } = await http.post<ApiEnvelope<HotspotProfileDBSyncResponse>>(url)
    return data.data
  },
}
