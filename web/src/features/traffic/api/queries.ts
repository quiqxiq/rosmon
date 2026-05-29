import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { useAuthStore } from '@/stores/auth-store'
import { useSSE, type UseSSEResult } from '@/lib/api/sse'
import * as svc from './service'
import type { TrafficTelemetryEvent } from './schema'
import { telemetryToTrafficSample } from '../data/data'
import type { TrafficSample } from '../data/schema'

// ─────────────────── Queries ───────────────────

export function useInterfaces(routerId: number) {
  return useQuery({
    queryKey: qk.networkInterfaces(routerId),
    queryFn: () => svc.listInterfaces(routerId),
    enabled: routerId > 0,
  })
}

export function useInterfaceTraffic(routerId: number, iface: string) {
  return useQuery({
    queryKey: qk.interfaceTraffic(routerId, iface),
    queryFn: () => svc.getInterfaceTraffic(routerId, iface),
    enabled: routerId > 0 && iface.length > 0,
  })
}

export function useQueues(routerId: number) {
  return useQuery({
    queryKey: qk.networkQueues(routerId),
    queryFn: () => svc.listQueues(routerId),
    enabled: routerId > 0,
  })
}

export function useNATRules(routerId: number) {
  return useQuery({
    queryKey: qk.natRules(routerId),
    queryFn: () => svc.listNATRules(routerId),
    enabled: routerId > 0,
  })
}

export function useDHCPLeases(routerId: number) {
  return useQuery({
    queryKey: qk.dhcpLeases(routerId),
    queryFn: () => svc.listDHCPLeases(routerId),
    enabled: routerId > 0,
  })
}

export function useIPPools(routerId: number) {
  return useQuery({
    queryKey: qk.networkPools(routerId),
    queryFn: () => svc.listIPPools(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── SSE ───────────────────

// Opens a live SSE feed for one interface and delivers transformed
// TrafficSample objects via `onSample`. The returned status drives the
// live indicator badge in the UI.
export function useTrafficStream(
  routerId: number,
  iface: string,
  onSample: (sample: TrafficSample) => void,
): UseSSEResult {
  return useSSE<TrafficTelemetryEvent>(
    routerId > 0 && iface.length > 0
      ? `/devices/${routerId}/stream/network/interfaces/${iface}/traffic`
      : null,
    (event) => {
      onSample(telemetryToTrafficSample(event as Parameters<typeof telemetryToTrafficSample>[0]))
    },
    { getToken: () => useAuthStore.getState().auth.accessToken },
  )
}
