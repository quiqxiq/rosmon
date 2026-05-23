// Device response dari GET /devices — sesuai dto.DeviceResponse backend.
export interface Device {
  id: number
  slug: string
  /** Display name router (mis. "Mikrotik HAP ac²"). Sebelumnya bernama `name`. */
  displayName: string
  address: string
  username: string
  useTls: boolean
  /** 'connected' | 'disconnected' | 'error' | 'connecting' */
  status: string
  active: boolean
  lastSeen?: string | null
  lastError?: string
  expiryCheckInterval: string
  createdAt: string
}

export interface DeviceWriteResponse {
  device: Device
  /** Warning diisi kalau record tersimpan tapi koneksi devmgr gagal. */
  warning?: string
}

export interface DeviceInput {
  slug: string
  /** Nama tampilan router. Dikirim sebagai `display_name` ke backend. */
  displayName: string
  address: string
  username: string
  password: string
  useTls?: boolean
  expiryCheckInterval?: string
}
