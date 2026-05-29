import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  HotspotDbProfileCreateInput,
  HotspotDbProfileFilters,
  HotspotDbProfileUpdateInput,
} from './schema'

const dbPrefix = (rid: number) => ['hotspot', 'profiles-db', rid] as const

export function useHotspotDbProfiles(
  routerId: number,
  filters?: HotspotDbProfileFilters,
) {
  return useQuery({
    queryKey: qk.hotspotProfilesDB(routerId, filters),
    queryFn: () => svc.listHotspotDbProfiles(routerId, filters),
    enabled: routerId > 0,
  })
}

export function useCreateHotspotDbProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: HotspotDbProfileCreateInput) =>
      svc.createHotspotDbProfile(routerId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: dbPrefix(routerId) }),
  })
}

export function useUpdateHotspotDbProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: HotspotDbProfileUpdateInput
    }) => svc.updateHotspotDbProfile(routerId, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: dbPrefix(routerId) }),
  })
}

export function useRemoveHotspotDbProfile(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.removeHotspotDbProfile(routerId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: dbPrefix(routerId) }),
  })
}

export function useSyncHotspotDbProfiles(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (role?: string) => svc.syncHotspotDbProfiles(routerId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: dbPrefix(routerId) }),
  })
}
