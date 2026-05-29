import { z } from 'zod'

// Mirror of dto.RouterPPPProfileResponse (api/dto/ppp.go) — the live
// RouterOS /ppp/profile object.
export const RouterPPPProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    local_address: z.string().optional(),
    remote_address: z.string().optional(),
    rate_limit: z.string().optional(),
    session_timeout: z.string().optional(),
    idle_timeout: z.string().optional(),
    parent_queue: z.string().optional(),
    on_up: z.string().optional(),
    on_down: z.string().optional(),
    disabled: z.boolean(),
    comment: z.string().optional(),
  })
  .passthrough()
export type RouterPPPProfile = z.infer<typeof RouterPPPProfileSchema>

// Body for POST /ppp/profiles — dto.RouterPPPProfileCreateRequest.
export type RouterPPPProfileCreateInput = {
  name: string
  local_address?: string
  remote_address?: string
  rate_limit?: string
  session_timeout?: string
  idle_timeout?: string
  parent_queue?: string
  disabled?: boolean
  comment?: string
}

// Body for PUT /ppp/profiles/{id} — sparse update.
export type RouterPPPProfileUpdateInput = {
  name?: string
  local_address?: string
  remote_address?: string
  rate_limit?: string
  session_timeout?: string
  idle_timeout?: string
  parent_queue?: string
  disabled?: boolean
  comment?: string
}
