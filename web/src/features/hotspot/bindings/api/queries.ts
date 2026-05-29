import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { IPBindingMutation } from './schema'

const bindingsPrefix = (routerId: number) =>
  ['hotspot', 'bindings', routerId] as const

// ─────────────────── Queries ───────────────────

export function useHotspotBindings(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotBindings(routerId),
    queryFn: () => svc.listIPBindings(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useAddIPBinding(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IPBindingMutation) =>
      svc.addIPBinding(routerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bindingsPrefix(routerId) })
    },
  })
}

export function useUpdateIPBinding(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IPBindingMutation }) =>
      svc.updateIPBinding(routerId, id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bindingsPrefix(routerId) })
    },
  })
}

export function useRemoveIPBinding(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removeIPBinding(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bindingsPrefix(routerId) })
    },
  })
}

export function useEnableIPBinding(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.enableIPBinding(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bindingsPrefix(routerId) })
    },
  })
}

export function useDisableIPBinding(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.disableIPBinding(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bindingsPrefix(routerId) })
    },
  })
}
