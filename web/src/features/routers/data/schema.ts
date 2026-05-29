import { z } from 'zod'

// Form schema for creating a router — matches CreateRouterRequest on the API.
// api_port defaults to 8728 (MikroTik default) so the field can be left empty.
export const RouterFormSchema = z.object({
  name: z.string().min(1).max(100),
  ip_address: z.string().min(1).max(255),
  api_port: z.number().int().min(1).max(65535).default(8728),
  api_username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  notes: z.string().max(500).optional(),
})
export type RouterFormValues = z.infer<typeof RouterFormSchema>

// Form schema for editing a router — all fields optional (partial update).
// Password is optional: leave empty to keep the existing credential.
export const RouterEditFormSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ip_address: z.string().min(1).max(255).optional(),
  api_port: z.number().int().min(1).max(65535).optional(),
  api_username: z.string().min(1).max(64).optional(),
  password: z.string().min(1).max(128).optional(),
  notes: z.string().max(500).optional(),
})
export type RouterEditFormValues = z.infer<typeof RouterEditFormSchema>
