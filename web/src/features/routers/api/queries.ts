import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  CreateRouterRequest,
  RouterPublicView,
  UpdateRouterRequest,
} from './schema'

// ─────────────────── Queries ───────────────────

// Polled at 30s by default to keep the switcher's status badge fresh
// without overwhelming the backend. Consumers needing real-time updates
// should subscribe to the SSE telemetry stream instead.
export function useRouters() {
  return useQuery({
    queryKey: qk.routers(),
    queryFn: () => svc.listRouters(),
    refetchInterval: 30_000,
  })
}

export function useRouter(id: number) {
  return useQuery({
    queryKey: qk.router(id),
    queryFn: () => svc.getRouter(id),
    enabled: id > 0,
  })
}

// ─────────────────── Mutations (scaffold for future Routers CRUD UI) ───────────────────

export function useCreateRouter() {
  const qc = useQueryClient()
  return useMutation<RouterPublicView, Error, CreateRouterRequest>({
    mutationFn: (body) => svc.createRouter(body),
    onSuccess: (data) => {
      qc.setQueryData(qk.router(data.id), data)
      qc.invalidateQueries({ queryKey: qk.routers() })
    },
  })
}

export function useUpdateRouter() {
  const qc = useQueryClient()
  return useMutation<
    RouterPublicView,
    Error,
    { id: number; body: UpdateRouterRequest }
  >({
    mutationFn: ({ id, body }) => svc.updateRouter(id, body),
    onSuccess: (data) => {
      qc.setQueryData(qk.router(data.id), data)
      qc.invalidateQueries({ queryKey: qk.routers() })
    },
  })
}

export function useDeleteRouter() {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: (id) => svc.deleteRouter(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: qk.router(id) })
      qc.invalidateQueries({ queryKey: qk.routers() })
    },
  })
}
