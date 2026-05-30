import { z } from 'zod'

// DB-backed PPP billing profile — dto.PPPProfileResponse (api/dto/ppp_profile.go).
// Distinct from the live RouterOS profile: this carries billing metadata and
// is persisted; the backend best-effort syncs it to /ppp/profile.
export const PPPDbProfileSchema = z.object({
  id: z.number(),
  device_id: z.number(),
  name: z.string(),
  rate_limit: z.string(),
  local_address: z.string(),
  remote_address: z.string(),
  session_timeout: z.string(),
  idle_timeout: z.string(),
  parent_queue: z.string(),
  price_monthly: z.number(),
  description: z.string(),
  active: z.boolean(),
  is_public: z.boolean().optional().default(false),
  created_at: z.string(),
  updated_at: z.string(),
})
export type PPPDbProfile = z.infer<typeof PPPDbProfileSchema>

export type PPPDbProfileCreateInput = {
  name: string
  rate_limit?: string
  local_address?: string
  remote_address?: string
  session_timeout?: string
  idle_timeout?: string
  parent_queue?: string
  price_monthly?: number
  description?: string
  active?: boolean
  is_public?: boolean
}

export type PPPDbProfileUpdateInput = {
  rate_limit?: string
  local_address?: string
  remote_address?: string
  session_timeout?: string
  idle_timeout?: string
  parent_queue?: string
  price_monthly?: number
  description?: string
  active?: boolean
  is_public?: boolean
}

// POST/PUT return { profile, warning? } — the warning surfaces a
// best-effort RouterOS propagation failure (device offline, etc.).
export type PPPDbProfileWriteResult = {
  profile: PPPDbProfile
  warning?: string
}

// POST /sync returns name buckets describing the reconcile outcome.
export type PPPDbProfileSyncResult = {
  synced: string[]
  created: string[]
  orphan: string[]
}
