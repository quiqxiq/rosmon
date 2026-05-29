import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  PPPDbProfileCreateInput,
  PPPDbProfileUpdateInput,
} from './schema'

const dbPrefix = (routerId: number) => ['ppp', 'profiles-db', routerId] as const

// ─────────────────── Queries ───────────────────

export function usePPPDbProfiles(routerId: number) {
  return useQuery({
    queryKey: qk.pppProfilesDB(routerId),
    queryFn: () => svc.listPPPDbProfiles(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useCreatePPPDbProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PPPDbProfileCreateInput) =>
      svc.createPPPDbProfile(routerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dbPrefix(routerId) })
    },
  })
}

export function useUpdatePPPDbProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: PPPDbProfileUpdateInput
    }) => svc.updatePPPDbProfile(routerId, id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dbPrefix(routerId) })
    },
  })
}

export function useRemovePPPDbProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.removePPPDbProfile(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dbPrefix(routerId) })
    },
  })
}

export function useSyncPPPDbProfiles(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => svc.syncPPPDbProfiles(routerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dbPrefix(routerId) })
    },
  })
}
