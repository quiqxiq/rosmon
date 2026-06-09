import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { RestLogEntry } from './schema'

// GET /devices/:id/log — seluruh backlog buffer log RouterOS (terbaru dulu).
// Filter topic dilakukan client-side (OR/contains) karena filter server-side
// RouterOS `where topics=` bersifat exact-match dan tidak cocok untuk entri
// multi-topic seperti "hotspot,account,info".
export async function listLogEntries(
  routerId: number,
): Promise<RestLogEntry[]> {
  const res = await apiClient.get<Envelope<RestLogEntry[]>>(
    `/devices/${routerId}/log`,
  )
  return unwrap(res.data)
}
