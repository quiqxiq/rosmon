import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { useSSE, type UseSSEResult } from '@/lib/api/sse'
import * as svc from './service'

const activePrefix = (routerId: number) => ['ppp', 'active', routerId] as const

// ─────────────────── Queries ───────────────────

export function usePPPActive(routerId: number) {
  return useQuery({
    queryKey: qk.pppActive(routerId),
    queryFn: () => svc.listPPPActive(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useDisconnectPPPActive(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.disconnectPPPActive(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: activePrefix(routerId) })
    },
  })
}

// ─────────────────── SSE ───────────────────

// Keeps the active-sessions list live by invalidating on each telemetry
// event. Returns the SSE status for the live-indicator dot.
export function usePPPActiveStream(routerId: number): UseSSEResult {
  const qc = useQueryClient()
  return useSSE<unknown>(
    routerId > 0 ? `/devices/${routerId}/stream/ppp/active` : null,
    () => {
      qc.invalidateQueries({ queryKey: activePrefix(routerId) })
    },
  )
}
