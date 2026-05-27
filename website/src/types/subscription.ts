export type SubscriptionStatus =
  | 'pending_install'
  | 'active'
  | 'isolir'
  | 'suspended'
  | 'terminated'

export type ServiceType = 'pppoe' | 'hotspot'

// Sesuai dto.SubscriptionResponse backend.
export interface Subscription {
  id: number
  customer_id: number
  device_id: number
  bandwidth_profile_id: number
  service_type: ServiceType
  mikrotik_username: string
  status: SubscriptionStatus
  activated_at?: string | null
  terminated_at?: string | null
  notes: string
  created_at: string
  updated_at: string
}

// Sesuai dto.SubscriptionCreateRequest backend.
export interface SubscriptionCreateInput {
  customer_id: number
  device_id: number
  bandwidth_profile_id: number
  service_type: ServiceType
  mikrotik_username: string
  mikrotik_password: string
  notes?: string
}

// Sesuai dto.SubscriptionUpdateRequest backend (sparse).
export interface SubscriptionUpdateInput {
  bandwidth_profile_id?: number
  mikrotik_password?: string
  notes?: string
}

export interface SubscriptionStatusPatchInput {
  status: SubscriptionStatus
}

// Sesuai dto.SubscriptionWriteResponse.
export interface SubscriptionWriteResponse {
  subscription: Subscription
  warning?: string
}

export interface SubscriptionListFilter {
  customer_id?: number
  device_id?: number
  status?: SubscriptionStatus
  service_type?: ServiceType
}
