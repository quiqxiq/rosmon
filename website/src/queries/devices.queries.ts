import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { devicesService } from '@/services/devices'
import { queryKeys } from '@/queries/query-keys'

export function useDevicesQuery() {
  return useQuery({
    queryKey: queryKeys.devices.all,
    queryFn: () => devicesService.list(),
  })
}

export function useDeviceQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.devices.detail(id),
    queryFn: () => devicesService.get(id),
    enabled: Boolean(id),
  })
}

export function useCreateDeviceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: devicesService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.devices.all }),
  })
}
