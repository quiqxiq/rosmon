import { apiClient } from '@/lib/api/client'
import type { AddResult, Envelope, RouterOSRecord } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  HotspotProfileParams,
  ProfileWithMeta,
  SyncProfilesResult,
} from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot-profiles`

// GET /hotspot/profiles — list enriched with mapping metadata.
// Returns the typed `ProfileWithMeta` shape (NOT a raw RouterOSRecord).
export async function listHotspotProfiles(
  routerId: number,
): Promise<ProfileWithMeta[]> {
  const res = await apiClient.get<Envelope<any[]>>(base(routerId))
  const data = unwrap(res.data)
  return data.map((p: any) => ({
    id: String(p.id),
    name: p.name,
    address_pool: p.address_pool,
    rate_limit: p.rate_limit,
    shared_users: p.shared_users === 0 ? 'unlimited' : String(p.shared_users),
    status_autorefresh: p.status_autorefresh,
    on_login: p.on_login,
    on_logout: p.on_logout,
    parent_queue: p.parent_queue,
    exp_mode: p.expiry_mode,
    price: p.price != null ? String(p.price) : undefined,
    selling_price: p.sell_price != null ? String(p.sell_price) : undefined,
    validity: p.validity,
    no_expiry: p.expiry_mode === '0',
    lock_user: p.lock_mac ? 'enable' : 'disable',
  }))
}

// GET /hotspot/profiles/{id} — raw RouterOS record (NOT enriched). The
// backend only enriches the LIST endpoint, so single-profile lookups
// return the bare RouterOS sentence.
export async function getHotspotProfile(
  routerId: number,
  id: string,
): Promise<RouterOSRecord> {
  const res = await apiClient.get<Envelope<any>>(
    `${base(routerId)}/${encodeURIComponent(id)}`,
  )
  return unwrap(res.data)
}

// POST /hotspot/profiles — create.
export async function addHotspotProfile(
  routerId: number,
  params: HotspotProfileParams,
): Promise<AddResult> {
  const payload = {
    name: params.name,
    role: "voucher",
    rate_limit: params.rate_limit,
    address_pool: params.address_pool,
    shared_users: params.shared_users === 'unlimited' ? 0 : params.shared_users ? Number(params.shared_users) : undefined,
    parent_queue: params.parent_queue,
    price: params.price,
    sell_price: params.selling_price,
    validity: params.validity,
    expiry_mode: params.expire_mode,
    lock_mac: params.lock_user === 'enable' ? true : params.lock_user === 'disable' ? false : undefined,
  }
  const res = await apiClient.post<Envelope<any>>(base(routerId), payload)
  const data = unwrap(res.data)
  return { id: String(data.profile.id) }
}

// PUT /hotspot/profiles/{id} — partial update.
export async function updateHotspotProfile(
  routerId: number,
  id: string,
  params: HotspotProfileParams,
): Promise<void> {
  const payload = {
    name: params.name,
    rate_limit: params.rate_limit,
    address_pool: params.address_pool,
    shared_users: params.shared_users === 'unlimited' ? 0 : params.shared_users ? Number(params.shared_users) : undefined,
    parent_queue: params.parent_queue,
    price: params.price,
    sell_price: params.selling_price,
    validity: params.validity,
    expiry_mode: params.expire_mode,
    lock_mac: params.lock_user === 'enable' ? true : params.lock_user === 'disable' ? false : undefined,
  }
  await apiClient.put(`${base(routerId)}/${encodeURIComponent(id)}`, payload)
}

// DELETE /hotspot/profiles/{id} — cascade-cleans schedulers tied to profile.
export async function removeHotspotProfile(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}

// POST /hotspot-profiles/sync — read all profiles, parse on-login scripts,
// upsert profile_price_mappings, replace on-login with multi-tenant format.
export async function syncHotspotProfiles(
  routerId: number,
): Promise<SyncProfilesResult> {
  const res = await apiClient.post<Envelope<SyncProfilesResult>>(
    `/devices/${routerId}/hotspot-profiles/sync`,
  )
  return unwrap(res.data)
}
