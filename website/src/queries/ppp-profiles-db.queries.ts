import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { pppProfilesDBService } from '@/services/ppp-profiles-db'
import { queryKeys } from '@/queries/query-keys'
import type { PPPProfileDBCreateInput, PPPProfileDBUpdateInput } from '@/types/ppp-profile-db'

export function usePPPProfilesDBQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => queryKeys.pppProfilesDB.all(toValue(deviceId) ?? '')),
    queryFn: () => pppProfilesDBService.list(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function usePPPProfileDBQuery(
  deviceId: MaybeRefOrGetter<string | null>,
  id: MaybeRefOrGetter<number | null>,
) {
  return useQuery({
    queryKey: computed(() =>
      queryKeys.pppProfilesDB.detail(toValue(deviceId) ?? '', toValue(id) ?? 0),
    ),
    queryFn: () => pppProfilesDBService.get(String(toValue(deviceId)), Number(toValue(id))),
    enabled: () => Boolean(toValue(deviceId)) && Boolean(toValue(id)),
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, deviceId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.pppProfilesDB.all(deviceId) })
}

export function useCreatePPPProfileDBMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PPPProfileDBCreateInput) =>
      pppProfilesDBService.create(String(toValue(deviceId)), input),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useUpdatePPPProfileDBMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PPPProfileDBUpdateInput }) =>
      pppProfilesDBService.update(String(toValue(deviceId)), id, input),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useRemovePPPProfileDBMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => pppProfilesDBService.remove(String(toValue(deviceId)), id),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}

export function useSyncPPPProfilesMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => pppProfilesDBService.sync(String(toValue(deviceId))),
    onSuccess: () => invalidate(qc, String(toValue(deviceId))),
  })
}
