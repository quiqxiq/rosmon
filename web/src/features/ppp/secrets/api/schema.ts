import { z } from 'zod'

// Mirror of dto.PPPSecretResponse (api/dto/ppp.go). The backend returns a
// typed JSON object (not a raw RouterOS record), so we model the documented
// fields and `passthrough()` anything new. Password is never exposed.
export const PPPSecretSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    service: z.string().optional(),
    profile: z.string().optional(),
    local_address: z.string().optional(),
    remote_address: z.string().optional(),
    limit_bytes_in: z.number().optional(),
    limit_bytes_out: z.number().optional(),
    last_logged_out: z.string().optional(),
    last_caller_id: z.string().optional(),
    last_disconnect_reason: z.string().optional(),
    disabled: z.boolean(),
    comment: z.string().optional(),
  })
  .passthrough()
export type PPPSecret = z.infer<typeof PPPSecretSchema>

// Body for POST /ppp/secrets — dto.PPPSecretCreateRequest.
export type PPPSecretCreateInput = {
  name: string
  password?: string
  service?: string
  profile?: string
  local_address?: string
  remote_address?: string
  limit_bytes_in?: number
  limit_bytes_out?: number
}

// Body for PUT /ppp/secrets/{id} — sparse update (dto.PPPSecretUpdateRequest).
export type PPPSecretUpdateInput = {
  name?: string
  password?: string
  service?: string
  profile?: string
  local_address?: string
  remote_address?: string
  limit_bytes_in?: number
  limit_bytes_out?: number
  comment?: string
}

// PPP service options accepted by RouterOS.
export const PPP_SERVICES = [
  'any',
  'pppoe',
  'pptp',
  'l2tp',
  'ovpn',
  'sstp',
] as const
