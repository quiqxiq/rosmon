import { type MaybeRefOrGetter, toValue } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { networkService } from '@/services/network'
import { queryKeys } from '@/queries/query-keys'

export function useInterfacesQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.network.interfaces(String(toValue(deviceId))),
    queryFn: () => networkService.listInterfaces(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useIPPoolsQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.network.ipPools(String(toValue(deviceId))),
    queryFn: () => networkService.listIPPools(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useDHCPLeasesQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.network.dhcpLeases(String(toValue(deviceId))),
    queryFn: () => networkService.listDHCPLeases(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useQueuesQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.network.queues(String(toValue(deviceId))),
    queryFn: () => networkService.listQueues(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useARPQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.network.arp(String(toValue(deviceId))),
    queryFn: () => networkService.listARP(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}
