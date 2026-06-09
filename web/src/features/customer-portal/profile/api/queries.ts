import { useMutation, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { changePortalPassword } from './service'

export function useChangePortalPassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: changePortalPassword,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.portalMe() })
    },
  })
}
