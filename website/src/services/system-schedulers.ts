import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { SystemScheduler } from '@/types/system'

const base = (deviceId: string) => `/devices/${deviceId}/system/schedulers`

export const systemSchedulersService = {
  async list(deviceId: string): Promise<SystemScheduler[]> {
    const { data } = await http.get<ApiEnvelope<SystemScheduler[]>>(base(deviceId))
    return data.data
  },
  async create(deviceId: string, payload: Partial<SystemScheduler>): Promise<SystemScheduler> {
    const { data } = await http.post<ApiEnvelope<SystemScheduler>>(base(deviceId), payload)
    return data.data
  },
  async remove(deviceId: string, id: string): Promise<void> {
    await http.delete(`${base(deviceId)}/${id}`)
  },
}
