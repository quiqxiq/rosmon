import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'

const cookiesPrefix = (routerId: number) =>
  ['hotspot', 'cookies', routerId] as const

// ─────────────────── Queries ───────────────────

export function useHotspotCookies(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotCookies(routerId),
    queryFn: () => svc.listHotspotCookies(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useRemoveHotspotCookie(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removeHotspotCookie(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cookiesPrefix(routerId) })
    },
  })
}
