import { z } from 'zod'

const expModeSchema = z.union([
  z.literal('rem'),
  z.literal('ntf'),
  z.literal('remc'),
  z.literal('ntfc'),
  z.literal('none'),
])
export type ExpMode = z.infer<typeof expModeSchema>

export const hotspotProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  sharedUsers: z.string(),
  rateLimit: z.string(),
  expMode: expModeSchema,
  validity: z.string(),
  price: z.number(),
  sellingPrice: z.number(),
  lockUser: z.boolean(),
  lockServer: z.boolean(),
  addressPool: z.string(),
  parentQueue: z.string(),
  hasExpiredMonitor: z.boolean(),
})
export type HotspotProfile = z.infer<typeof hotspotProfileSchema>
