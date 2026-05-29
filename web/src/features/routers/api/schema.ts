import { z } from 'zod'

// Source: api/dto/device.go#/DeviceResponse. The backend strips the password
// before sending. `address` is the combined host:port (e.g. 192.168.1.1:8728).
export const RouterStatusSchema = z.enum([
  'connected',
  'connecting',
  'disconnected',
  'error',
  'unknown',
])
export type RouterStatus = z.infer<typeof RouterStatusSchema>

export const RouterPublicViewSchema = z.object({
  id: z.number().int(),
  display_name: z.string(),
  address: z.string(),
  username: z.string(),
  use_tls: z.boolean().optional(),
  status: RouterStatusSchema.catch('unknown'),
  last_seen: z.string().nullable().optional(),
  last_error: z.string().optional(),
  expiry_check_interval: z.string().optional(),
  time_zone: z.string().optional(),
  active: z.boolean().optional(),
  created_at: z.string().optional(),
})
export type RouterPublicView = z.infer<typeof RouterPublicViewSchema>

// POST /devices body — api/dto/device.go#/DeviceCreateRequest.
export const CreateRouterRequestSchema = z.object({
  display_name: z.string().min(1).max(128),
  address: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  use_tls: z.boolean().optional(),
  expiry_check_interval: z.string().optional(),
})
export type CreateRouterRequest = z.infer<typeof CreateRouterRequestSchema>

// PUT /devices/:id body — partial update. Backend re-tests the connection
// when address/username/password change.
export const UpdateRouterRequestSchema = z.object({
  display_name: z.string().min(1).max(128).optional(),
  address: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  use_tls: z.boolean().optional(),
  active: z.boolean().optional(),
})
export type UpdateRouterRequest = z.infer<typeof UpdateRouterRequestSchema>
