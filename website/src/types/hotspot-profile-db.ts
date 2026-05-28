// DB-backed Hotspot profiles (sesuai dto.HotspotProfileResponse backend).
// Role 'permanent' = langganan bulanan; 'voucher' = expiry-based.
export type HotspotProfileRole = 'permanent' | 'voucher'

export type ExpiryMode = '0' | 'rem' | 'ntf' | 'remc' | 'ntfc'

export interface HotspotProfileDB {
  id: number
  device_id: number
  name: string
  role: HotspotProfileRole
  rate_limit: string

  // Permanent fields
  price_monthly: number

  // Voucher fields
  expiry_mode: ExpiryMode
  validity: string
  price: number
  sell_price: number
  lock_mac: boolean

  description: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface HotspotProfileDBCreateInput {
  name: string
  role: HotspotProfileRole
  rate_limit?: string
  price_monthly?: number
  expiry_mode?: ExpiryMode
  validity?: string
  price?: number
  sell_price?: number
  lock_mac?: boolean
  description?: string
  active?: boolean
}

export interface HotspotProfileDBUpdateInput {
  rate_limit?: string
  price_monthly?: number
  expiry_mode?: ExpiryMode
  validity?: string
  price?: number
  sell_price?: number
  lock_mac?: boolean
  description?: string
  active?: boolean
}

export interface HotspotProfileDBWriteResponse {
  profile: HotspotProfileDB
  warning?: string
}

export interface HotspotProfileDBSyncResponse {
  synced: string[]
  created: string[]
  orphan: string[]
}

export interface HotspotProfileDBListFilter {
  role?: HotspotProfileRole
  only_active?: boolean
}
