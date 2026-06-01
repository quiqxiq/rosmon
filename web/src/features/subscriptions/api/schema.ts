import { z } from 'zod'

export type ServiceType = 'pppoe' | 'hotspot'
export type SubscriptionStatus =
  | 'pending_install'
  | 'active'
  | 'isolir'
  | 'suspended'
  | 'terminated'

// dto.SubscriptionResponse
export const SubscriptionSchema = z.object({
  id: z.number(),
  customer_id: z.number(),
  device_id: z.number(),
  ppp_profile_id: z.number().nullable().optional(),
  hotspot_profile_id: z.number().nullable().optional(),
  service_type: z.string(),
  mikrotik_username: z.string(),
  status: z.string(),
  sync_status: z.string(),
  sync_notes: z.string().optional(),
  notes: z.string(),
  // Anniversary billing
  billing_day: z.number().nullable().optional(),
  next_invoice_date: z.string().nullable().optional(),
  activated_at: z.string().nullable().optional(),
  terminated_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Subscription = z.infer<typeof SubscriptionSchema>

export type SubscriptionCreateInput = {
  customer_id: number
  device_id: number
  ppp_profile_id?: number
  hotspot_profile_id?: number
  service_type: ServiceType
  mikrotik_username: string
  mikrotik_password: string
  /** Tanggal billing per bulan (1–28). Null = fallback ke setting global. */
  billing_day?: number
  notes?: string
}

export type SubscriptionUpdateInput = {
  ppp_profile_id?: number
  hotspot_profile_id?: number
  mikrotik_password?: string
  notes?: string
}

export type SubscriptionWriteResult = {
  subscription: Subscription
  warning?: string
}

export type SubscriptionListFilters = {
  customer_id?: number
  device_id?: number
  status?: string
  service_type?: string
}

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'pending_install',
  'active',
  'isolir',
  'suspended',
  'terminated',
]
