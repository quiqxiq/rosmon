import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { HotspotProfileParams } from './schema'

const profilesPrefix = (routerId: number) =>
  ['hotspot', 'profiles', routerId] as const

// ─────────────────── Queries ───────────────────

export function useHotspotProfiles(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotProfiles(routerId),
    queryFn: () => svc.listHotspotProfiles(routerId),
    enabled: routerId > 0,
  })
}

export function useHotspotProfile(routerId: number, id: string) {
  return useQuery({
    queryKey: qk.hotspotProfile(routerId, id),
    queryFn: () => svc.getHotspotProfile(routerId, id),
    enabled: routerId > 0 && id.length > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useAddHotspotProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: HotspotProfileParams) =>
      svc.addHotspotProfile(routerId, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}

export function useUpdateHotspotProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: string
      params: HotspotProfileParams
    }) => svc.updateHotspotProfile(routerId, id, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}

export function useRemoveHotspotProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removeHotspotProfile(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}

export function useSyncHotspotProfiles(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => svc.syncHotspotProfiles(routerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profilesPrefix(routerId) })
    },
  })
}
