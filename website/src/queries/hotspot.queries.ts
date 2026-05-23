import { type MaybeRefOrGetter, toValue } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { hotspotUsersService } from '@/services/hotspot-users'
import { hotspotProfilesService } from '@/services/hotspot-profiles'
import { hotspotSessionsService } from '@/services/hotspot-sessions'
import { queryKeys } from '@/queries/query-keys'

export function useHotspotUsersQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.hotspot.users(String(toValue(deviceId))),
    queryFn: () => hotspotUsersService.list(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useHotspotProfilesQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.hotspot.profiles(String(toValue(deviceId))),
    queryFn: () => hotspotProfilesService.list(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useHotspotActiveQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.hotspot.active(String(toValue(deviceId))),
    queryFn: () => hotspotSessionsService.listActive(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useHotspotBindingsQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.hotspot.bindings(String(toValue(deviceId))),
    queryFn: () => hotspotSessionsService.listBindings(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useHotspotHostsQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: queryKeys.hotspot.hosts(String(toValue(deviceId))),
    queryFn: () => hotspotSessionsService.listHosts(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useHotspotCookiesQuery(deviceId: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: ['hotspot', 'cookies', String(toValue(deviceId))] as const,
    queryFn: () => hotspotSessionsService.listCookies(String(toValue(deviceId))),
    enabled: () => Boolean(toValue(deviceId)),
  })
}
