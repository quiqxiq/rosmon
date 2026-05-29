import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { IPPoolCreateInput } from './schema'

// ── Pools ──
export function usePools(routerId: number) {
  return useQuery({
    queryKey: qk.networkPools(routerId),
    queryFn: () => svc.listPools(routerId),
    enabled: routerId > 0,
  })
}

export function useCreatePool(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: IPPoolCreateInput) => svc.createPool(routerId, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.networkPools(routerId) }),
  })
}

export function useDeletePool(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.deletePool(routerId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.networkPools(routerId) }),
  })
}

// ── Queues ──
export function useQueues(routerId: number) {
  return useQuery({
    queryKey: qk.networkQueues(routerId),
    queryFn: () => svc.listQueues(routerId),
    enabled: routerId > 0,
  })
}

export function useDeleteQueue(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.deleteQueue(routerId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.networkQueues(routerId) }),
  })
}

// ── DHCP ──
export function useDHCPLeases(routerId: number) {
  return useQuery({
    queryKey: qk.dhcpLeases(routerId),
    queryFn: () => svc.listDHCPLeases(routerId),
    enabled: routerId > 0,
  })
}

export function useDeleteDHCPLease(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => svc.deleteDHCPLease(routerId, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.dhcpLeases(routerId) }),
  })
}

// ── ARP (manual lookup by MAC) ──
export function useArpByMac(routerId: number, mac: string) {
  return useQuery({
    queryKey: qk.networkArp(routerId, mac),
    queryFn: () => svc.arpByMac(routerId, mac),
    enabled: routerId > 0 && mac.trim().length > 0,
  })
}
