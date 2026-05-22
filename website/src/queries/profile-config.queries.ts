import { type MaybeRefOrGetter, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { profileConfigService } from '@/services/profile-config'
import { queryKeys } from '@/queries/query-keys'

export function useProfileConfigsQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.profileConfig.all(String(toValue(deviceId))),
    queryFn: () => profileConfigService.list(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useUpsertProfileConfigMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof profileConfigService.upsert>[1]) =>
      profileConfigService.upsert(String(toValue(deviceId)), payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.profileConfig.all(String(toValue(deviceId))) }),
  })
}
