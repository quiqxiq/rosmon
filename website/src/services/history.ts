import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { HistoryQuery, HistorySeries } from '@/types/history'

export const historyService = {
  async query(deviceId: string, query: HistoryQuery): Promise<HistorySeries> {
    const { data } = await http.post<ApiEnvelope<HistorySeries>>(
      `/devices/${deviceId}/history/query`,
      query,
    )
    return data.data
  },
}
