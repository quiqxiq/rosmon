import { useMutation, useQuery } from '@tanstack/vue-query'
import { authService } from '@/services/auth'
import { queryKeys } from '@/queries/query-keys'

export function useMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => authService.me(),
    enabled,
  })
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: authService.login,
  })
}

export function useRefreshMutation() {
  return useMutation({
    mutationFn: (refreshToken: string) => authService.refresh(refreshToken),
  })
}
