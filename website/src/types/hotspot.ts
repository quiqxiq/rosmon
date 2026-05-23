// Sesuai dto.HotspotUserResponse backend.
export interface HotspotUser {
  id: string
  name: string
  profile: string
  server?: string
  disabled: boolean
  comment?: string
  macAddress?: string
  address?: string
  email?: string
  routes?: string
  limitUptime?: string
  limitBytesTotal: number
  limitBytesIn: number
  limitBytesOut: number
  bytesIn: number
  bytesOut: number
  uptime?: string
}

// Sesuai dto.HotspotProfileResponse backend.
export interface HotspotProfile {
  id: string
  name: string
  addressPool?: string
  rateLimit?: string
  sharedUsers: number
  statusAutorefresh?: string
  onLogin?: string
  onLogout?: string
  parentQueue?: string
  idleTimeout?: string
  keepaliveTimeout?: string
  sessionTimeout?: string
  macCookieTimeout?: string
  addMacCookie: boolean
  transparentProxy: boolean
}

// Sesuai dto.HotspotActiveResponse backend.
export interface HotspotSession {
  id: string
  user: string
  address?: string
  macAddress?: string
  server?: string
  loginBy?: string
  uptime?: string
  bytesIn: number
  bytesOut: number
  packetsIn: number
  packetsOut: number
  idleTime?: string
  sessionTimeLeft?: string
  keepaliveTimeout?: string
  comment?: string
}

// Sesuai dto.HotspotHostResponse backend.
export interface HotspotHost {
  id: string
  macAddress?: string
  address?: string
  toAddress?: string
  server?: string
  authorized: boolean
  bypassed: boolean
  dynamic: boolean
  dhcp: boolean
  uptime?: string
  idleTime?: string
  keepaliveTimeout?: string
  bytesIn: number
  bytesOut: number
  comment?: string
}

// Sesuai dto.HotspotBindingResponse backend.
export interface HotspotIpBinding {
  id: string
  macAddress?: string
  address?: string
  toAddress?: string
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
  macAddress?: string
  /** Nama field di backend adalah expires_in (camelCase: expiresIn). */
  expiresIn?: string
}

// Sesuai dto.HotspotServerResponse backend.
export interface HotspotServer {
  id: string
  name: string
  profile?: string
  interface?: string
  addressPool?: string
  addressesPerMac?: string
  idleTimeout?: string
  keepaliveTimeout?: string
  loginTimeout?: string
  disabled: boolean
}

// Request body untuk POST /hotspot/vouchers (generate).
export interface VoucherGenerateRequest {
  count: number
  profile: string
  prefix?: string
  length?: number
  charset?: string
  comment?: string
}
