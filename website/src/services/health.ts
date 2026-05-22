import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  version: string
  uptime: number
}

export const healthService = {
  async check(): Promise<HealthStatus> {
    const { data } = await http.get<ApiEnvelope<HealthStatus>>('/health')
    return data.data
  },
}
