import { z } from 'zod'

export const hotspotHostSchema = z.object({
  id: z.string(),
  macAddress: z.string(),
  address: z.string(),
  toAddress: z.string(),
  server: z.string(),
  authorized: z.boolean(),
  bypassed: z.boolean(),
  dhcp: z.boolean(),
  dynamic: z.boolean(),
  comment: z.string(),
})
export type HotspotHost = z.infer<typeof hotspotHostSchema>

export type HostFilter = 'all' | 'authorized' | 'bypassed'
