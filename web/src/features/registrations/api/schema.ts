import { z } from 'zod'

export type RegistrationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'

// dto.RegistrationResponse (api/dto/registration.go).
export const RegistrationSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  phone: z.string(),
  address: z.string(),
  area: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  service_type: z.string().optional().default(''),
  ppp_profile_id: z.number().nullable().optional(),
  hotspot_profile_id: z.number().nullable().optional(),
  device_id: z.number().nullable().optional(),
  status: z.string(),
  rejection_reason: z.string().optional().default(''),
  reviewed_by: z.number().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  assigned_to: z.number().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  installed_at: z.string().nullable().optional(),
  customer_id: z.number().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Registration = z.infer<typeof RegistrationSchema>

export type RegistrationFilters = {
  status?: string
}

export type ApproveInput = { scheduled_at?: string | null }
export type RejectInput = { reason: string }
export type AssignInput = { assigned_to: number; scheduled_at?: string | null }

export type CompleteInstallInput = {
  device_id: number
  service_type: 'pppoe' | 'hotspot'
  ppp_profile_id?: number
  hotspot_profile_id?: number
  mikrotik_username: string
  mikrotik_password: string
  billing_day?: number
}
