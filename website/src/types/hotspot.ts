export interface HotspotUser {
  id: string
  name: string
  password?: string
  profile: string
  server?: string
  bytesIn?: number
  bytesOut?: number
  uptime?: string
  disabled?: boolean
  comment?: string
}

export interface HotspotProfile {
  id: string
  name: string
  rateLimit?: string
  sessionTimeout?: string
  sharedUsers?: number
  addressPool?: string
}

export interface HotspotSession {
  id: string
  user: string
  address: string
  macAddress: string
  uptime: string
  bytesIn: number
  bytesOut: number
  server?: string
}

export interface HotspotHost {
  id: string
  address: string
  macAddress: string
  toAddress?: string
  server?: string
  uptime?: string
}

export interface HotspotBinding {
  id: string
  macAddress: string
  address?: string
  toAddress?: string
  type: 'regular' | 'bypassed' | 'blocked'
  disabled?: boolean
}

export interface VoucherGenerateRequest {
  count: number
  profile: string
  prefix?: string
  length?: number
  comment?: string
}
