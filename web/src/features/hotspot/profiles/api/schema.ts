import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/hotspot.yaml#/ProfileWithMeta
//
// Returned by GET /hotspot/profiles. This is one of the few RouterOS-backed
// endpoints with a TYPED response (snake_case keys) — the backend enriches
// raw RouterOS profile records with `profile_price_mappings` rows from the
// local DB before returning. Use this shape only for the LIST endpoint.
export const ProfileWithMetaSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    address_pool: z.string().optional(),
    rate_limit: z.string().optional(),
    shared_users: z.string().optional(),
    status_autorefresh: z.string().optional(),
    on_login: z.string().optional(),
    on_logout: z.string().optional(),
    parent_queue: z.string().optional(),
    exp_mode: z.string().optional(),
    price: z.string().optional(),
    selling_price: z.string().optional(),
    validity: z.string().optional(),
    no_expiry: z.boolean().optional(),
    lock_user: z.string().optional(),
    lock_server: z.string().optional(),
  })
  .passthrough()
export type ProfileWithMeta = z.infer<typeof ProfileWithMetaSchema>

// Mirror of HotspotProfileParams — body for POST/PUT.
// All fields are optional except `name` (required on POST; ignored on PUT
// since the path already identifies the profile).
export const HotspotProfileParamsSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  rate_limit: z.string().max(64).optional(),
  address_pool: z.string().max(64).optional(),
  shared_users: z.string().max(8).optional(),
  parent_queue: z.string().max(64).optional(),
  price: z.number().int().min(0).optional(),
  selling_price: z.number().int().min(0).optional(),
  validity: z.string().max(64).optional(),
  expire_mode: z.string().max(32).optional(),
  lock_user: z.string().max(16).optional(),
  lock_server: z.string().max(16).optional(),
})
export type HotspotProfileParams = z.infer<typeof HotspotProfileParamsSchema>

// Result of POST /hotspot/profiles/sync — counters reported by the backend
// after rewriting on-login scripts to the multi-tenant format.
export const SyncProfilesResultSchema = z.object({
  synced: z.array(z.string()),
  created: z.array(z.string()),
  orphan: z.array(z.string()),
})
export type SyncProfilesResult = z.infer<typeof SyncProfilesResultSchema>
