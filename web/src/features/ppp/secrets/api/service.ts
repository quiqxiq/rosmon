import { apiClient } from '@/lib/api/client'
import type { AddResult, Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  PPPSecret,
  PPPSecretCreateInput,
  PPPSecretUpdateInput,
} from './schema'

const base = (rid: number) => `/devices/${rid}/ppp/secrets`

// GET /ppp/secrets — list all PPP secrets on the device.
export async function listPPPSecrets(routerId: number): Promise<PPPSecret[]> {
  const res = await apiClient.get<Envelope<PPPSecret[]>>(base(routerId))
  return unwrap(res.data)
}

// POST /ppp/secrets — create. Returns the new RouterOS `.id`.
export async function addPPPSecret(
  routerId: number,
  payload: PPPSecretCreateInput,
): Promise<AddResult> {
  const res = await apiClient.post<Envelope<AddResult>>(base(routerId), payload)
  return unwrap(res.data)
}

// PUT /ppp/secrets/{id} — sparse update.
export async function updatePPPSecret(
  routerId: number,
  id: string,
  patch: PPPSecretUpdateInput,
): Promise<void> {
  await apiClient.put(`${base(routerId)}/${encodeURIComponent(id)}`, patch)
}

// PATCH /ppp/secrets/{id}/disabled — toggle the enabled flag.
export async function setPPPSecretDisabled(
  routerId: number,
  id: string,
  disabled: boolean,
): Promise<void> {
  await apiClient.patch(
    `${base(routerId)}/${encodeURIComponent(id)}/disabled`,
    { disabled },
  )
}

// DELETE /ppp/secrets/{id}.
export async function removePPPSecret(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}
