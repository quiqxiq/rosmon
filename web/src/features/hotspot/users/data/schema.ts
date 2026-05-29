import { z } from 'zod'

const hotspotUserStatusSchema = z.union([
  z.literal('online'),
  z.literal('expired'),
  z.literal('idle'),
  z.literal('offline'),
])
export type HotspotUserStatus = z.infer<typeof hotspotUserStatusSchema>

export const hotspotUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  profile: z.string(),
  macAddress: z.string(),
  ipAddress: z.string().optional(),
  server: z.string(),
  status: hotspotUserStatusSchema,
  uptime: z.string(),
  bytesIn: z.number(),
  bytesOut: z.number(),
  comment: z.string().optional(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
})
export type HotspotUser = z.infer<typeof hotspotUserSchema>
