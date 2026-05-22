import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { Routerboard, SystemClock, SystemIdentity, SystemResource } from '@/types/system'

const base = (deviceId: string) => `/devices/${deviceId}/system`

export const systemService = {
  async identity(deviceId: string): Promise<SystemIdentity> {
    const { data } = await http.get<ApiEnvelope<SystemIdentity>>(`${base(deviceId)}/identity`)
    return data.data
  },
  async resource(deviceId: string): Promise<SystemResource> {
    const { data } = await http.get<ApiEnvelope<SystemResource>>(`${base(deviceId)}/resource`)
    return data.data
  },
  async routerboard(deviceId: string): Promise<Routerboard> {
    const { data } = await http.get<ApiEnvelope<Routerboard>>(`${base(deviceId)}/routerboard`)
    return data.data
  },
  async clock(deviceId: string): Promise<SystemClock> {
    const { data } = await http.get<ApiEnvelope<SystemClock>>(`${base(deviceId)}/clock`)
    return data.data
  },
  async reboot(deviceId: string): Promise<void> {
    await http.post(`${base(deviceId)}/reboot`)
  },
  async shutdown(deviceId: string): Promise<void> {
    await http.post(`${base(deviceId)}/shutdown`)
  },
}
