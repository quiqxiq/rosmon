// Sesuai dto.HotspotUserResponse backend (snake_case 1:1).
export interface HotspotUser {
  id: string
  name: string
  profile: string
  server?: string
  disabled: boolean
  comment?: string
  mac_address?: string
  address?: string
  email?: string
  routes?: string
  limit_uptime?: string
  limit_bytes_total: number
  limit_bytes_in: number
  limit_bytes_out: number
  bytes_in: number
  bytes_out: number
  uptime?: string
}

// Sesuai dto.HotspotProfileResponse backend.
export interface HotspotProfile {
  id: string
  name: string
  address_pool?: string
  rate_limit?: string
  shared_users: number
  status_autorefresh?: string
  on_login?: string
  on_logout?: string
  parent_queue?: string
  idle_timeout?: string
  keepalive_timeout?: string
  session_timeout?: string
  mac_cookie_timeout?: string
  add_mac_cookie: boolean
  transparent_proxy: boolean
}

// Sesuai dto.HotspotProfileCreateRequest backend — field writable saat
// POST /devices/:id/hotspot/profiles. on_logout + timeouts + flags
// (add_mac_cookie, transparent_proxy) tidak di-expose karena router
// mengelola sendiri / read-only.
export interface HotspotProfileCreateInput {
  name: string
  address_pool?: string
  rate_limit?: string
  shared_users?: number
  status_autorefresh?: string
  on_login?: string
  parent_queue?: string
}

export type HotspotProfileUpdateInput = Partial<HotspotProfileCreateInput>

export interface HotspotUserCreateInput {
  name: string
  password?: string
  profile?: string
  server?: string
  disabled?: boolean
  comment?: string
  mac_address?: string
  limit_uptime?: string
  limit_bytes_total?: number
  limit_bytes_in?: number
  limit_bytes_out?: number
}

export type HotspotUserUpdateInput = Partial<HotspotUserCreateInput>

// Sesuai dto.HotspotActiveResponse backend.
export interface HotspotSession {
  id: string
  user: string
  address?: string
  mac_address?: string
  server?: string
  login_by?: string
  uptime?: string
  bytes_in: number
  bytes_out: number
  packets_in: number
  packets_out: number
  idle_time?: string
  session_time_left?: string
  keepalive_timeout?: string
  comment?: string
}

// Sesuai dto.HotspotHostResponse backend.
export interface HotspotHost {
  id: string
  mac_address?: string
  address?: string
  to_address?: string
  server?: string
  authorized: boolean
  bypassed: boolean
  dynamic: boolean
  dhcp: boolean
  uptime?: string
  idle_time?: string
  keepalive_timeout?: string
  bytes_in: number
  bytes_out: number
  comment?: string
}

// Sesuai dto.HotspotBindingResponse backend.
export interface HotspotIpBinding {
  id: string
  mac_address?: string
  address?: string
  to_address?: string
  server?: string
  /** 'regular' | 'bypassed' | 'blocked' */
  type: string
  disabled: boolean
  bypassed: boolean
  comment?: string
}

// Sesuai dto.HotspotCookieResponse backend.
export interface HotspotCookie {
  id: string
  user?: string
  domain?: string
  mac_address?: string
  expires_in?: string
}

// Sesuai dto.HotspotServerResponse backend.
export interface HotspotServer {
  id: string
  name: string
  profile?: string
  interface?: string
  address_pool?: string
  addresses_per_mac?: string
  idle_timeout?: string
  keepalive_timeout?: string
  login_timeout?: string
  disabled: boolean
}

// Request body untuk POST /hotspot/vouchers/generate.
// Field names sesuai backend dto.VoucherGenerateRequest (snake_case 1:1).
export interface VoucherGenerateRequest {
  batch_size: number          // required, 1–1000
  profile: string             // required
  charset: string             // required: 'number'|'upper'|'lower'|'mixed'|'upper_number'|'lower_number'|'mixed_number'
  length: number              // required, 4–32
  user_mode?: 'vc' | 'up'    // 'vc'=username=password (voucher code), 'up'=independent password
  prefix?: string             // max 16 chars
  server?: string             // default: 'all'
  validity?: string           // Go duration: "168h", "30d" — stamp expiry di comment
  price?: number
  sell_price?: number
  time_limit?: string
  data_limit?: number
  comment?: string
  lock_to_mac?: boolean
}

// Satu voucher dari response POST /hotspot/vouchers/generate.
export interface GeneratedVoucher {
  id: string
  username: string
  password: string
}

// Response body POST /hotspot/vouchers/generate.
export interface VoucherGenerateResponse {
  vouchers: GeneratedVoucher[]
  count: number
  partial?: boolean  // true kalau gagal di tengah jalan
  error?: string     // pesan error kalau partial=true
}
