import { useMutation, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { RegistrationSubmitInput } from './schema'

export function usePublicPackages() {
  return useQuery({
    queryKey: qk.publicPackages(),
    queryFn: () => svc.getPublicPackages(),
    staleTime: 60_000,
  })
}

export function useSubmitRegistration() {
  return useMutation({
    mutationFn: (payload: RegistrationSubmitInput) =>
      svc.submitRegistration(payload),
  })
}
