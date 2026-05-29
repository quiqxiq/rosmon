import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { PPPActive } from './schema'

const base = (rid: number) => `/devices/${rid}/ppp/active`

// GET /ppp/active — list active PPP sessions.
export async function listPPPActive(routerId: number): Promise<PPPActive[]> {
  const res = await apiClient.get<Envelope<PPPActive[]>>(base(routerId))
  return unwrap(res.data)
}

// DELETE /ppp/active/{id} — disconnect (kick) an active session.
export async function disconnectPPPActive(
  routerId: number,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(routerId)}/${encodeURIComponent(id)}`)
}
