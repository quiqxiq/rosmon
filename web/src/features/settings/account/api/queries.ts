import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as svc from './service'
import type { UpdateMePayload } from './service'

const meKey = ['me'] as const

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: svc.getMe,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateMePayload) => svc.updateMe(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meKey })
    },
  })
}
