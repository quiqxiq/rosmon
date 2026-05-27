import type { ServiceType } from '@/types/subscription'

// Sesuai dto.BandwidthProfileResponse backend.
// Field service-specific (mis. AddressPool, LocalAddress) hanya bermakna
// untuk service_type yang relevan; untuk service_type lawan, field tersebut
// akan kosong/0 dari backend.
export interface BandwidthProfile {
  id: number
  device_id: number
  service_type: ServiceType
  name: string
  mikrotik_profile_name: string

  // Common (PPPoE + Hotspot)
  rate_limit: string
  parent_queue: string

  // PPPoE-only
  local_address: string
  remote_address: string
  session_timeout: string
  idle_timeout: string

  // Hotspot-only
  address_pool: string
  shared_users: number

  // Business
  price_monthly: number
  description: string
  active: boolean
  created_at: string
  updated_at: string
}

// Sesuai dto.BandwidthProfileCreateRequest backend. Frontend kirim semua
// field; backend hanya pass ke MikroTik kalau service_type match.
export interface BandwidthProfileCreateInput {
  service_type: ServiceType
  name: string
  mikrotik_profile_name: string

  rate_limit?: string
  parent_queue?: string

  // PPPoE-only
  local_address?: string
  remote_address?: string
  session_timeout?: string
  idle_timeout?: string

  // Hotspot-only
  address_pool?: string
  shared_users?: number

  // Business
  price_monthly?: number
  description?: string
  active?: boolean
}

// Sesuai dto.BandwidthProfileUpdateRequest backend (sparse).
// service_type & mikrotik_profile_name TIDAK boleh diubah (natural key).
export interface BandwidthProfileUpdateInput {
  name?: string

  rate_limit?: string
  parent_queue?: string

  local_address?: string
  remote_address?: string
  session_timeout?: string
  idle_timeout?: string

  address_pool?: string
  shared_users?: number

  price_monthly?: number
  description?: string
  active?: boolean
}

export interface BandwidthProfileWriteResponse {
  profile: BandwidthProfile
  warning?: string
}

export interface BandwidthProfileSyncResponse {
  synced: string[]
  created: string[]
  orphan: string[]
  skipped: string[]
}

export interface BandwidthProfileListFilter {
  service_type?: ServiceType
  only_active?: boolean
}
