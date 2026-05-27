import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { bandwidthProfilesService } from '@/services/bandwidth-profiles'
import { queryKeys } from '@/queries/query-keys'
import type {
  BandwidthProfileCreateInput,
  BandwidthProfileListFilter,
  BandwidthProfileUpdateInput,
} from '@/types/bandwidth-profile'

export function useBandwidthProfilesQuery(
  deviceId: MaybeRefOrGetter<string | null>,
  filter: MaybeRefOrGetter<BandwidthProfileListFilter> = () => ({}),
) {
  return useQuery({
    queryKey: computed(() => [
      ...queryKeys.bandwidthProfiles.all(String(toValue(deviceId) ?? '')),
      toValue(filter),
    ]),
    queryFn: () => bandwidthProfilesService.list(String(toValue(deviceId)), toValue(filter)),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, deviceId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.bandwidthProfiles.all(deviceId) })
}

export function useCreateBandwidthProfileMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: BandwidthProfileCreateInput) =>
      bandwidthProfilesService.create(String(toValue(deviceId)), input),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useUpdateBandwidthProfileMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: BandwidthProfileUpdateInput }) =>
      bandwidthProfilesService.update(String(toValue(deviceId)), id, input),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useRemoveBandwidthProfileMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      bandwidthProfilesService.remove(String(toValue(deviceId)), id),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useSyncBandwidthProfilesMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => bandwidthProfilesService.sync(String(toValue(deviceId))),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}
