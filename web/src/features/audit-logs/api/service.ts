import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { AuditLog, AuditLogFilters } from './schema'

const base = '/audit-logs'

// GET /audit-logs — admin only. Server-side filters optional; the table also
// filters client-side for entity_type/action facets.
export async function listAuditLogs(
  filters?: AuditLogFilters,
): Promise<AuditLog[]> {
  const res = await apiClient.get<Envelope<AuditLog[]>>(base, {
    params: filters,
  })
  return unwrap(res.data)
}
