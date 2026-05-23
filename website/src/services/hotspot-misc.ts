import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { HotspotUser, VoucherGenerateRequest } from '@/types/hotspot'

export const hotspotMiscService = {
  async generateVouchers(deviceId: string, req: VoucherGenerateRequest): Promise<HotspotUser[]> {
    const { data } = await http.post<ApiEnvelope<HotspotUser[]>>(
      `/devices/${deviceId}/hotspot/vouchers/generate`,
      req,
    )
    return data.data
  },
}
