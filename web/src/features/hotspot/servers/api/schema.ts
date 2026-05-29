import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/HotspotServerRecord
//
// Hotspot server instance configured on the router. Read-only via the
// SPA — server creation is provisioning-time work done outside Roskit.
export const HotspotServerRecordSchema = z
  .object({
    '.id': z.string(),
    name: z.string().optional(),
    interface: z.string().optional(),
    disabled: z.enum(['true', 'false']).optional(),
  })
  .passthrough()
export type HotspotServerRecord = z.infer<typeof HotspotServerRecordSchema>
