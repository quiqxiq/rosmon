import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  ApproveInput,
  AssignInput,
  CompleteInstallInput,
  RegistrationFilters,
  RejectInput,
} from './schema'

export function useRegistrations(filters?: RegistrationFilters) {
  return useQuery({
    queryKey: qk.registrations(filters),
    queryFn: () => svc.listRegistrations(filters),
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['registrations'] })
    qc.invalidateQueries({ queryKey: ['customers'] })
    qc.invalidateQueries({ queryKey: ['subscriptions'] })
  }
}

export function useApproveRegistration() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ApproveInput }) =>
      svc.approveRegistration(id, payload),
    onSuccess: invalidate,
  })
}

export function useRejectRegistration() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RejectInput }) =>
      svc.rejectRegistration(id, payload),
    onSuccess: invalidate,
  })
}

export function useAssignRegistration() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AssignInput }) =>
      svc.assignRegistration(id, payload),
    onSuccess: invalidate,
  })
}

export function useCompleteInstall() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: CompleteInstallInput
    }) => svc.completeInstall(id, payload),
    onSuccess: invalidate,
  })
}
