import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'

// ─────────────────── Queries ───────────────────
//
// Read-only: hotspot server config is managed at provisioning time, not
// by the SPA. This module exposes only the list query.

export function useHotspotServers(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotServers(routerId),
    queryFn: () => svc.listHotspotServers(routerId),
    enabled: routerId > 0,
  })
}
