import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { QuickPrintPackageInput } from './schema'

// Prefix covers both the list query and every single-package query so
// one invalidate after a mutation wipes everything stale.
const packagesPrefix = (routerId: number) =>
  ['quick-print', 'packages', routerId] as const

// ─────────────────── Queries ───────────────────

export function useQuickPrintPackages(routerId: number) {
  return useQuery({
    queryKey: qk.quickPrintPackages(routerId),
    queryFn: () => svc.listQuickPrintPackages(routerId),
    enabled: routerId > 0,
  })
}

export function useQuickPrintPackage(routerId: number, name: string) {
  return useQuery({
    queryKey: qk.quickPrintPackage(routerId, name),
    queryFn: () => svc.getQuickPrintPackage(routerId, name),
    enabled: routerId > 0 && name.length > 0,
  })
}

// ─────────────────── Mutations ───────────────────

export function useCreateQuickPrintPackage(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: QuickPrintPackageInput) =>
      svc.createQuickPrintPackage(routerId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: packagesPrefix(routerId) })
    },
  })
}

export function useUpdateQuickPrintPackage(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      name,
      body,
    }: {
      name: string
      body: QuickPrintPackageInput
    }) => svc.updateQuickPrintPackage(routerId, name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: packagesPrefix(routerId) })
    },
  })
}

export function useRemoveQuickPrintPackage(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => svc.removeQuickPrintPackage(routerId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: packagesPrefix(routerId) })
    },
  })
}
