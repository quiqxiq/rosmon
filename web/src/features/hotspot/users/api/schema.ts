import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/HotspotUserRecord
//
// `passthrough()` keeps unknown RouterOS keys intact so this schema does
// not reject newer RouterOS versions that add fields. The fields below
// are the documented common keys; consumers should treat anything extra
// as opaque strings.
export const HotspotUserRecordSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    password: z.string().optional(),
    profile: z.string().optional(),
    server: z.string().optional(),
    'mac-address': z.string().optional(),
    'limit-uptime': z.string().optional(),
    'limit-bytes-total': z.string().optional(),
    'bytes-in': z.string().optional(),
    'bytes-out': z.string().optional(),
    uptime: z.string().optional(),
    disabled: z.enum(['true', 'false']).optional(),
    comment: z.string().optional(),
  })
  .passthrough()
export type HotspotUserRecord = z.infer<typeof HotspotUserRecordSchema>

// Body for POST /hotspot/users and PUT /hotspot/users/{id}.
// RouterOS accepts a free-form `name → value` map; common keys mirror
// the read shape minus `.id`. We do not constrain values because every
// RouterOS argument is a string anyway.
export const HotspotUserMutationSchema = z.record(z.string(), z.string())
export type HotspotUserMutation = z.infer<typeof HotspotUserMutationSchema>

// Optional list filter — only `profile` is supported per OpenAPI.
export type HotspotUserListFilters = {
  profile?: string
  comment?: string
}
