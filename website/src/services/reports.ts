import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { SalesSummary, VoucherSale } from '@/types/report'

const base = (deviceId: string) => `/devices/${deviceId}/reports`

export const reportsService = {
  async listSales(deviceId: string, from?: string, to?: string): Promise<VoucherSale[]> {
    const { data } = await http.get<ApiEnvelope<VoucherSale[]>>(`${base(deviceId)}/sales`, {
      params: { from, to },
    })
    return data.data
  },
  async summary(deviceId: string, date?: string): Promise<SalesSummary> {
    const { data } = await http.get<ApiEnvelope<SalesSummary>>(`${base(deviceId)}/summary`, {
      params: { date },
    })
    return data.data
  },
  async exportCsv(deviceId: string, from?: string, to?: string): Promise<Blob> {
    const { data } = await http.get(`${base(deviceId)}/export.csv`, {
      params: { from, to },
      responseType: 'blob',
    })
    return data
  },
}
