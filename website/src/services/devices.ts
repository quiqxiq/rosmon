import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { Device, DeviceInput, DeviceWriteResponse } from '@/types/device'

// Backend menggunakan snake_case untuk JSON — adapter di sini.
function toPayload(input: DeviceInput) {
  return {
    slug: input.slug,
    display_name: input.displayName,
    address: input.address,
    username: input.username,
    password: input.password,
    use_tls: input.useTls ?? false,
    expiry_check_interval: input.expiryCheckInterval ?? '',
  }
}

export const devicesService = {
  async list(): Promise<Device[]> {
    const { data } = await http.get<ApiEnvelope<Device[]>>('/devices')
    return data.data
  },

  async get(id: string): Promise<Device> {
    const { data } = await http.get<ApiEnvelope<Device>>(`/devices/${id}`)
    return data.data
  },

  async create(input: DeviceInput): Promise<DeviceWriteResponse> {
    const { data } = await http.post<ApiEnvelope<any>>('/devices', toPayload(input))
    const raw = data.data
    if (raw && raw.device) {
      return raw as DeviceWriteResponse
    }
    return {
      device: raw as Device,
    }
  },

  async update(id: string, input: Partial<DeviceInput>): Promise<DeviceWriteResponse> {
    const payload: Record<string, unknown> = {}
    if (input.displayName !== undefined) payload.display_name = input.displayName
    if (input.address !== undefined) payload.address = input.address
    if (input.username !== undefined) payload.username = input.username
    if (input.password !== undefined) payload.password = input.password
    if (input.useTls !== undefined) payload.use_tls = input.useTls
    if (input.expiryCheckInterval !== undefined) payload.expiry_check_interval = input.expiryCheckInterval
    
    // Gunakan PUT sesuai registrasi handler backend Go (bukan PATCH)
    const { data } = await http.put<ApiEnvelope<any>>(`/devices/${id}`, payload)
    const raw = data.data
    if (raw && raw.device) {
      return raw as DeviceWriteResponse
    }
    return {
      device: raw as Device,
    }
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/devices/${id}`)
  },
}
