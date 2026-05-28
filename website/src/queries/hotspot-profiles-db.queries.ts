import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { hotspotProfilesDBService } from '@/services/hotspot-profiles-db'
import { queryKeys } from '@/queries/query-keys'
import type {
  HotspotProfileDBCreateInput,
  HotspotProfileDBListFilter,
  HotspotProfileDBUpdateInput,
} from '@/types/hotspot-profile-db'

export function useHotspotProfilesDBQuery(
  deviceId: MaybeRefOrGetter<string | null>,
  filter: MaybeRefOrGetter<HotspotProfileDBListFilter> = () => ({}),
) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeys.hotspotProfilesDB.all(toValue(deviceId) ?? ''),
      toValue(filter),
    ]),
    queryFn: () =>
      hotspotProfilesDBService.list(String(toValue(deviceId)), toValue(filter)),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useHotspotProfileDBQuery(
  deviceId: MaybeRefOrGetter<string | null>,
  id: MaybeRefOrGetter<number | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      queryKeys.hotspotProfilesDB.detail(toValue(deviceId) ?? '', toValue(id) ?? 0),
    ),
    queryFn: () =>
      hotspotProfilesDBService.get(String(toValue(deviceId)), Number(toValue(id))),
    enabled: () => Boolean(toValue(deviceId)) && Boolean(toValue(id)),
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, deviceId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.hotspotProfilesDB.all(deviceId) })
}

export function useCreateHotspotProfileDBMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: HotspotProfileDBCreateInput) =>
      hotspotProfilesDBService.create(String(toValue(deviceId)), input),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useUpdateHotspotProfileDBMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: HotspotProfileDBUpdateInput }) =>
      hotspotProfilesDBService.update(String(toValue(deviceId)), id, input),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useRemoveHotspotProfileDBMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      hotspotProfilesDBService.remove(String(toValue(deviceId)), id),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useSyncHotspotProfilesMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (role?: string) =>
      hotspotProfilesDBService.sync(String(toValue(deviceId)), role),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}
