import { type MaybeRefOrGetter, toValue } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { pppService } from '@/services/ppp'
import { queryKeys } from '@/queries/query-keys'

export function usePPPSecretsQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.ppp.secrets(String(toValue(deviceId))),
    queryFn: () => pppService.listSecrets(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function usePPPProfilesQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.ppp.profiles(String(toValue(deviceId))),
    queryFn: () => pppService.listProfiles(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function usePPPActiveQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.ppp.active(String(toValue(deviceId))),
    queryFn: () => pppService.listActive(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}
