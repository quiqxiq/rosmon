import { z } from 'zod'

const loginBySchema = z.union([
  z.literal('http-chap'),
  z.literal('http-pap'),
  z.literal('mac'),
  z.literal('cookie'),
  z.literal('trial'),
])
export type LoginBy = z.infer<typeof loginBySchema>

export const hotspotActiveSchema = z.object({
  id: z.string(),
  user: z.string(),
  address: z.string(),
  macAddress: z.string(),
  server: z.string(),
  uptime: z.string(),
  sessionTimeLeft: z.string(),
  keepaliveTimeout: z.string(),
  loginBy: loginBySchema,
  bytesIn: z.number(),
  bytesOut: z.number(),
  comment: z.string(),
})
export type HotspotActive = z.infer<typeof hotspotActiveSchema>
