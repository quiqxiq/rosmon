import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'

const hostsPrefix = (routerId: number) =>
  ['hotspot', 'hosts', routerId] as const

// ─────────────────── Queries ───────────────────

export function useHotspotHosts(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotHosts(routerId),
    queryFn: () => svc.listHotspotHosts(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useRemoveHotspotHost(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removeHotspotHost(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hostsPrefix(routerId) })
    },
  })
}
