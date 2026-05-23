import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { devicesService } from '@/services/devices'
import type { DeviceInput } from '@/types/device'
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
    mutationFn: (input: DeviceInput) => devicesService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.devices.all }),
  })
}

export function useUpdateDeviceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DeviceInput> }) => devicesService.update(id, input),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.devices.all })
      qc.invalidateQueries({ queryKey: queryKeys.devices.detail(variables.id) })
    },
  })
}

export function useRemoveDeviceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => devicesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.devices.all }),
  })
}
