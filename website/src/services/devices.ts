import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { Device, DeviceInput } from '@/types/device'

export const devicesService = {
  async list(): Promise<Device[]> {
    const { data } = await http.get<ApiEnvelope<Device[]>>('/devices')
    return data.data
  },
  async get(id: string): Promise<Device> {
    const { data } = await http.get<ApiEnvelope<Device>>(`/devices/${id}`)
    return data.data
  },
  async create(input: DeviceInput): Promise<Device> {
    const { data } = await http.post<ApiEnvelope<Device>>('/devices', input)
    return data.data
  },
  async update(id: string, input: Partial<DeviceInput>): Promise<Device> {
    const { data } = await http.patch<ApiEnvelope<Device>>(`/devices/${id}`, input)
    return data.data
  },
  async remove(id: string): Promise<void> {
    await http.delete(`/devices/${id}`)
  },
}
