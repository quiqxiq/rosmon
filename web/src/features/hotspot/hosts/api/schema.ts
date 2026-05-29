import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/HotspotHostRecord
//
// Host learning entry — what the router has seen attached to a hotspot
// interface, regardless of authentication state.
export const HotspotHostRecordSchema = z
  .object({
    '.id': z.string(),
    'mac-address': z.string().optional(),
    address: z.string().optional(),
    server: z.string().optional(),
    'to-address': z.string().optional(),
    authorized: z.enum(['true', 'false']).optional(),
  })
  .passthrough()
export type HotspotHostRecord = z.infer<typeof HotspotHostRecordSchema>
