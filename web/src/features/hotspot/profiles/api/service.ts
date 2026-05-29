import { apiClient } from '@/lib/api/client'
import type { AddResult, Envelope, RouterOSRecord } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  HotspotProfileParams,
  ProfileWithMeta,
  SyncProfilesResult,
} from './schema'

const base = (rid: number) => `/devices/${rid}/hotspot/profiles`

// GET /hotspot/profiles — list enriched with mapping metadata.
// Returns the typed `ProfileWithMeta` shape (NOT a raw RouterOSRecord).
export async function listHotspotProfiles(
  routerId: number,
): Promise<ProfileWithMeta[]> {
  const res = await apiClient.get<Envelope<ProfileWithMeta[]>>(base(routerId))
  return unwrap(res.data)
}

// GET /hotspot/profiles/{id} — raw RouterOS record (NOT enriched). The
// backend only enriches the LIST endpoint, so single-profile lookups
// return the bare RouterOS sentence.
export async function getHotspotProfile(
  routerId: number,
  id: string,
): Promise<RouterOSRecord> {
  const res = await apiClient.get<Envelope<RouterOSRecord>>(
    `${base(routerId)}/${encodeURIComponent(id)}`,
  )
  return unwrap(res.data)
}

// POST /hotspot/profiles — create.
export async function addHotspotProfile(
  routerId: number,
  params: HotspotProfileParams,
): Promise<AddResult> {
  const res = await apiClient.post<Envelope<AddResult>>(base(routerId), params)
  return unwrap(res.data)
}

// PUT /hotspot/profiles/{id} — partial update.
export async function updateHotspotProfile(
  routerId: number,
  id: string,
  params: HotspotProfileParams,
): Promise<void> {
  await apiClient.put(`${base(routerId)}/${encodeURIComponent(id)}`, params)
}

// DELETE /hotspot/profiles/{id} — cascade-cleans schedulers tied to profile.
export async function removeHotspotProfile(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}

// POST /hotspot/profiles/sync — read all profiles, parse on-login scripts,
// upsert profile_price_mappings, replace on-login with multi-tenant format.
export async function syncHotspotProfiles(
  routerId: number,
): Promise<SyncProfilesResult> {
  const res = await apiClient.post<Envelope<SyncProfilesResult>>(
    `${base(routerId)}/sync`,
  )
  return unwrap(res.data)
}
