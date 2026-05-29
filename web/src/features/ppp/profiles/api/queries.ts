import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  RouterPPPProfileCreateInput,
  RouterPPPProfileUpdateInput,
} from './schema'

const profilesPrefix = (routerId: number) =>
  ['ppp', 'profiles', routerId] as const

// ─────────────────── Queries ───────────────────

export function usePPPProfiles(routerId: number) {
  return useQuery({
    queryKey: qk.pppProfiles(routerId),
    queryFn: () => svc.listPPPProfiles(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useAddPPPProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: RouterPPPProfileCreateInput) =>
      svc.addPPPProfile(routerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}

export function useUpdatePPPProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: RouterPPPProfileUpdateInput
    }) => svc.updatePPPProfile(routerId, id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}

export function useRemovePPPProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removePPPProfile(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}
