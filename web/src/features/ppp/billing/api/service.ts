import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  PPPDbProfile,
  PPPDbProfileCreateInput,
  PPPDbProfileSyncResult,
  PPPDbProfileUpdateInput,
  PPPDbProfileWriteResult,
} from './schema'

const base = (rid: number) => `/devices/${rid}/ppp-profiles`

// GET /ppp-profiles — list DB-backed billing profiles.
export async function listPPPDbProfiles(
  routerId: number,
): Promise<PPPDbProfile[]> {
  const res = await apiClient.get<Envelope<PPPDbProfile[]>>(base(routerId))
  return unwrap(res.data)
}

// POST /ppp-profiles — create. Returns { profile, warning? }.
export async function createPPPDbProfile(
  routerId: number,
  payload: PPPDbProfileCreateInput,
): Promise<PPPDbProfileWriteResult> {
  const res = await apiClient.post<Envelope<PPPDbProfileWriteResult>>(
    base(routerId),
    payload,
  )
  return unwrap(res.data)
}

// PUT /ppp-profiles/{id} — update. Returns { profile, warning? }.
export async function updatePPPDbProfile(
  routerId: number,
  id: number,
  payload: PPPDbProfileUpdateInput,
): Promise<PPPDbProfileWriteResult> {
  const res = await apiClient.put<Envelope<PPPDbProfileWriteResult>>(
    `${base(routerId)}/${id}`,
    payload,
  )
  return unwrap(res.data)
}

// DELETE /ppp-profiles/{id} — 204, or 200 with { warning } on partial.
export async function removePPPDbProfile(
  routerId: number,
  id: number,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${id}`)
}

// POST /ppp-profiles/sync — pull /ppp/profile from the router into the DB.
export async function syncPPPDbProfiles(
  routerId: number,
): Promise<PPPDbProfileSyncResult> {
  const res = await apiClient.post<Envelope<PPPDbProfileSyncResult>>(
    `${base(routerId)}/sync`,
  )
  return unwrap(res.data)
}
