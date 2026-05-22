import { API_BASE_URL } from '@/utils/env'
import { useAuthStore } from '@/stores/auth'

export type StreamPath =
  | 'hotspot/active'
  | 'hotspot/users'
  | 'hotspot/inactive'
  | 'ppp/active'
  | 'ppp/secrets'
  | 'ppp/inactive'
  | 'log'
  | 'system/resource'
  | 'network/interfaces/stats'
  | 'network/queues/stats'

export function buildStreamUrl(deviceId: string, path: StreamPath | string): string {
  const auth = useAuthStore()
  const url = new URL(`${API_BASE_URL}/devices/${deviceId}/stream/${path}`, window.location.origin)
  if (auth.accessToken) {
    url.searchParams.set('access_token', auth.accessToken)
  }
  return url.toString()
}

export function buildInterfaceTrafficUrl(deviceId: string, ifaceName: string): string {
  return buildStreamUrl(deviceId, `network/interfaces/${encodeURIComponent(ifaceName)}/traffic`)
}
