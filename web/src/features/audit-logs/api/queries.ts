import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { AuditLogFilters } from './schema'

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: qk.auditLogs(filters),
    queryFn: () => svc.listAuditLogs(filters),
  })
}
