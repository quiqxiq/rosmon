import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { useSSE, type UseSSEResult } from '@/lib/api/sse'
import * as svc from './service'

const activePrefix = (routerId: number) =>
  ['hotspot', 'active', routerId] as const

// Disconnect also clears the user's cookie, so cookie list must be invalidated.
const cookiesPrefix = (routerId: number) =>
  ['hotspot', 'cookies', routerId] as const

// ─────────────────── Queries ───────────────────

export function useHotspotActive(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotActive(routerId),
    queryFn: () => svc.listHotspotActive(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useRemoveHotspotActive(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removeHotspotActive(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activePrefix(routerId) })
    },
  })
}

export function useDisconnectHotspotUser(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.disconnectHotspotUser(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activePrefix(routerId) })
      qc.invalidateQueries({ queryKey: cookiesPrefix(routerId) })
    },
  })
}

// ─────────────────── SSE ───────────────────

// `useHotspotActiveStream` keeps the active-sessions list live by
// invalidating the query on every telemetry event for the
// `hotspot_active` measurement. Returns the SSE status so the page can
// render a live-indicator dot.
export function useHotspotActiveStream(routerId: number): UseSSEResult {
  const qc = useQueryClient()
  return useSSE<unknown>(
    routerId > 0 ? `/devices/${routerId}/stream/hotspot/active` : null,
    () => {
      qc.invalidateQueries({ queryKey: activePrefix(routerId) })
    },
  )
}
