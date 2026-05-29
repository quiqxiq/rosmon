import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/HotspotCookieRecord
//
// Remembered hotspot login cookies. RouterOS stores them per
// (user, mac, address) tuple; clearing one forces a full re-auth on
// next connect.
export const HotspotCookieRecordSchema = z
  .object({
    '.id': z.string(),
    user: z.string().optional(),
    'mac-address': z.string().optional(),
    address: z.string().optional(),
  })
  .passthrough()
export type HotspotCookieRecord = z.infer<typeof HotspotCookieRecordSchema>
