import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { PPPSecretCreateInput, PPPSecretUpdateInput } from './schema'

const secretsPrefix = (routerId: number) =>
  ['ppp', 'secrets', routerId] as const

// ─────────────────── Queries ───────────────────

export function usePPPSecrets(routerId: number) {
  return useQuery({
    queryKey: qk.pppSecrets(routerId),
    queryFn: () => svc.listPPPSecrets(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useAddPPPSecret(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PPPSecretCreateInput) =>
      svc.addPPPSecret(routerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: secretsPrefix(routerId) })
    },
  })
}

export function useUpdatePPPSecret(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PPPSecretUpdateInput }) =>
      svc.updatePPPSecret(routerId, id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: secretsPrefix(routerId) })
    },
  })
}

export function useSetPPPSecretDisabled(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      svc.setPPPSecretDisabled(routerId, id, disabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: secretsPrefix(routerId) })
    },
  })
}

export function useRemovePPPSecret(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.removePPPSecret(routerId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: secretsPrefix(routerId) })
    },
  })
}
