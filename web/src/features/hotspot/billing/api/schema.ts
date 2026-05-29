import { z } from 'zod'

export type HotspotRole = 'permanent' | 'voucher'
export type ExpiryMode = '0' | 'rem' | 'ntf' | 'remc' | 'ntfc'

// dto.HotspotProfileResponse (api/dto/hotspot_profile.go).
export const HotspotDbProfileSchema = z.object({
  id: z.number(),
  device_id: z.number(),
  name: z.string(),
  role: z.enum(['permanent', 'voucher']),
  rate_limit: z.string(),
  address_pool: z.string(),
  shared_users: z.number(),
  status_autorefresh: z.string(),
  parent_queue: z.string(),
  price_monthly: z.number().optional(),
  expiry_mode: z.string().optional(),
  validity: z.string().optional(),
  price: z.number().optional(),
  sell_price: z.number().optional(),
  lock_mac: z.boolean().optional(),
  description: z.string(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type HotspotDbProfile = z.infer<typeof HotspotDbProfileSchema>

export type HotspotDbProfileCreateInput = {
  name: string
  role: HotspotRole
  rate_limit?: string
  address_pool?: string
  shared_users?: number
  status_autorefresh?: string
  parent_queue?: string
  price_monthly?: number
  expiry_mode?: ExpiryMode
  validity?: string
  price?: number
  sell_price?: number
  lock_mac?: boolean
  description?: string
  active?: boolean
}

export type HotspotDbProfileUpdateInput = Omit<
  HotspotDbProfileCreateInput,
  'name' | 'role'
>

export type HotspotDbProfileWriteResult = {
  profile: HotspotDbProfile
  warning?: string
}

export type HotspotDbProfileSyncResult = {
  synced: string[]
  created: string[]
  orphan: string[]
}

export type HotspotDbProfileFilters = {
  role?: HotspotRole
  only_active?: boolean
}
