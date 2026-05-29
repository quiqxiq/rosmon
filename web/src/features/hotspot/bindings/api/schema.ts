import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/IPBindingRecord
//
// IP binding — exempts a (mac, ip) pair from hotspot authentication or
// blocks it entirely. `type` enum:
//   - regular   — normal hotspot client (no exemption)
//   - blocked   — denied access at the hotspot layer
//   - bypassed  — skip hotspot, treat like a normal LAN client
export const IPBindingRecordSchema = z
  .object({
    '.id': z.string(),
    'mac-address': z.string().optional(),
    address: z.string().optional(),
    type: z.enum(['regular', 'blocked', 'bypassed']).optional(),
    disabled: z.enum(['true', 'false']).optional(),
    comment: z.string().optional(),
  })
  .passthrough()
export type IPBindingRecord = z.infer<typeof IPBindingRecordSchema>

// Body POST/PUT — RouterOS accepts free-form key/value pairs.
// Common keys: `mac-address`, `address`, `type`, `comment`, `disabled`,
// `to-address`, `server`.
export const IPBindingMutationSchema = z.record(z.string(), z.string())
export type IPBindingMutation = z.infer<typeof IPBindingMutationSchema>
