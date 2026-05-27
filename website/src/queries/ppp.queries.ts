import { type MaybeRefOrGetter, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { pppService } from '@/services/ppp'
import { queryKeys } from '@/queries/query-keys'
import type { PPPProfileCreateInput, PPPProfileUpdateInput } from '@/types/ppp'

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

// ── PPP Profile mutations ────────────────────────────────────────────────

export function useCreatePPPProfileMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PPPProfileCreateInput) =>
      pppService.createProfile(String(toValue(deviceId)), input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ppp.profiles(String(toValue(deviceId))) })
    },
  })
}

export function useUpdatePPPProfileMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PPPProfileUpdateInput }) =>
      pppService.updateProfile(String(toValue(deviceId)), id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ppp.profiles(String(toValue(deviceId))) })
    },
  })
}

export function useRemovePPPProfileMutation(deviceId: MaybeRefOrGetter<string | null>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pppService.removeProfile(String(toValue(deviceId)), id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ppp.profiles(String(toValue(deviceId))) })
    },
  })
}
