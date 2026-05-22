import type { HotspotSession, HotspotUser } from '@/types/hotspot'
import type { PPPActive, PPPInactiveEvent, PPPSecret } from '@/types/ppp'
import type { SystemResource } from '@/types/system'

export type StreamChangeKind = 'added' | 'updated' | 'removed'

export interface ChangeEvent<T> {
  kind: StreamChangeKind
  id: string
  item: T
}

export type HotspotActiveStreamEvent = ChangeEvent<HotspotSession>
export type HotspotUsersStreamEvent = ChangeEvent<HotspotUser>
export type HotspotInactiveStreamEvent = ChangeEvent<HotspotUser>
export type PPPActiveStreamEvent = ChangeEvent<PPPActive>
export type PPPSecretsStreamEvent = ChangeEvent<PPPSecret>
export type PPPInactiveStreamEvent = ChangeEvent<PPPInactiveEvent>

export interface LogStreamEvent {
  timestamp: string
  topics: string[]
  message: string
}

export interface ResourceStreamEvent {
  timestamp: string
  resource: SystemResource
}

export interface TrafficStreamEvent {
  timestamp: string
  interface: string
  rxBps: number
  txBps: number
}

export interface InterfaceStatsStreamEvent {
  timestamp: string
  interfaces: Array<{ name: string; rxBytes: number; txBytes: number }>
}

export interface QueueStatsStreamEvent {
  timestamp: string
  queues: Array<{ name: string; rxBytes: number; txBytes: number }>
}
