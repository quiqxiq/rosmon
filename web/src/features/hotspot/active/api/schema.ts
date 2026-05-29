import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/HotspotActiveRecord
//
// Active hotspot session. RouterOS-style hyphenated keys; common ones
// documented here, the rest pass through untouched.
export const HotspotActiveRecordSchema = z
  .object({
    '.id': z.string(),
    user: z.string().optional(),
    address: z.string().optional(),
    'mac-address': z.string().optional(),
    server: z.string().optional(),
    uptime: z.string().optional(),
    'session-time-left': z.string().optional(),
    'keepalive-timeout': z.string().optional(),
    'login-by': z.string().optional(),
  })
  .passthrough()
export type HotspotActiveRecord = z.infer<typeof HotspotActiveRecordSchema>
