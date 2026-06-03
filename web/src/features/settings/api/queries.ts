import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { listSettings, updateSetting } from './service'

export function useSystemSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: listSettings,
    staleTime: 60_000,
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateSetting(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings() })
    },
  })
}
