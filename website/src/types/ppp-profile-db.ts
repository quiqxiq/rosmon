// DB-backed PPP profiles (sesuai dto.PPPProfileResponse backend).
// Berbeda dengan PPPProfile di ppp.ts yang merupakan live RouterOS data.
export interface PPPProfileDB {
  id: number
  device_id: number
  name: string
  rate_limit: string
  price_monthly: number
  description: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface PPPProfileDBCreateInput {
  name: string
  rate_limit?: string
  price_monthly?: number
  description?: string
  active?: boolean
}

export interface PPPProfileDBUpdateInput {
  rate_limit?: string
  price_monthly?: number
  description?: string
  active?: boolean
}

export interface PPPProfileDBWriteResponse {
  profile: PPPProfileDB
  warning?: string
}

export interface PPPProfileDBSyncResponse {
  synced: string[]
  created: string[]
  orphan: string[]
}
