import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type {
  BandwidthProfile,
  BandwidthProfileCreateInput,
  BandwidthProfileListFilter,
  BandwidthProfileSyncResponse,
  BandwidthProfileUpdateInput,
  BandwidthProfileWriteResponse,
} from '@/types/bandwidth-profile'

const base = (deviceId: string) => `/devices/${deviceId}/bandwidth-profiles`

function normalizeWrite(raw: unknown): BandwidthProfileWriteResponse {
  const r = raw as Partial<BandwidthProfileWriteResponse> & Partial<BandwidthProfile>
  if (r && 'profile' in r && r.profile) {
    return { profile: r.profile, warning: r.warning }
  }
  return { profile: r as BandwidthProfile }
}

export const bandwidthProfilesService = {
  async list(deviceId: string, filter: BandwidthProfileListFilter = {}): Promise<BandwidthProfile[]> {
    const params = new URLSearchParams()
    if (filter.service_type) params.set('service_type', filter.service_type)
    if (filter.only_active) params.set('only_active', 'true')
    const qs = params.toString()
    const url = qs ? `${base(deviceId)}?${qs}` : base(deviceId)
    const { data } = await http.get<ApiEnvelope<BandwidthProfile[]>>(url)
    return data.data
  },
  async get(deviceId: string, id: number): Promise<BandwidthProfile> {
    const { data } = await http.get<ApiEnvelope<BandwidthProfile>>(
      `${base(deviceId)}/${id}`,
    )
    return data.data
  },
  async create(
    deviceId: string,
    input: BandwidthProfileCreateInput,
  ): Promise<BandwidthProfileWriteResponse> {
    const { data } = await http.post<ApiEnvelope<unknown>>(base(deviceId), input)
    return normalizeWrite(data.data)
  },
  async update(
    deviceId: string,
    id: number,
    input: BandwidthProfileUpdateInput,
  ): Promise<BandwidthProfileWriteResponse> {
    const { data } = await http.put<ApiEnvelope<unknown>>(`${base(deviceId)}/${id}`, input)
    return normalizeWrite(data.data)
  },
  async remove(deviceId: string, id: number): Promise<BandwidthProfileWriteResponse | null> {
    const { data, status } = await http.delete<ApiEnvelope<unknown>>(`${base(deviceId)}/${id}`)
    if (status === 204) return null
    return normalizeWrite(data?.data)
  },
  async sync(deviceId: string): Promise<BandwidthProfileSyncResponse> {
    const { data } = await http.post<ApiEnvelope<BandwidthProfileSyncResponse>>(
      `${base(deviceId)}/sync`,
    )
    return data.data
  },
}
