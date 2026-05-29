import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'

// ─────────────────── Queries ───────────────────
//
// No mutations — clients mutate inactive users through the regular
// `/hotspot/users` surface. This file is queries only.

export function useHotspotInactive(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotInactive(routerId),
    queryFn: () => svc.listInactiveHotspotUsers(routerId),
    enabled: routerId > 0,
  })
}

export function useHotspotInactiveCount(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotInactiveCount(routerId),
    queryFn: () => svc.getInactiveHotspotUserCount(routerId),
    enabled: routerId > 0,
  })
}
