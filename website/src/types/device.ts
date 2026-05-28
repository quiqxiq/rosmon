// Device response dari GET /devices — sesuai dto.DeviceResponse backend (snake_case).
export interface Device {
  id: number
  /** Display name router (mis. "Mikrotik HAP ac²"). */
  display_name: string
  address: string
  username: string
  use_tls: boolean
  /** 'connected' | 'disconnected' | 'error' | 'connecting' */
  status: string
  active: boolean
  last_seen?: string | null
  last_error?: string
  expiry_check_interval: string
  isolir_profile: string
  paused_profile: string
  created_at: string
}

export interface DeviceWriteResponse {
  device: Device
  /** Warning diisi kalau record tersimpan tapi koneksi devmgr gagal. */
  warning?: string
}

// Request body untuk POST /devices & PUT /devices/{id} — snake_case 1:1.
export interface DeviceInput {
  display_name: string
  address: string
  username: string
  password: string
  use_tls?: boolean
  expiry_check_interval?: string
  isolir_profile?: string
  paused_profile?: string
}
