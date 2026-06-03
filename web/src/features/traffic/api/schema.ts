import { z } from 'zod'

// Mirror of docs/openapi/components/schemas/network.yaml
//
// `passthrough()` keeps unknown RouterOS keys intact so this schema does
// not reject newer RouterOS versions that add fields. The fields below
// are the documented common keys; consumers should treat anything extra
// as opaque strings.

export const InterfaceRecordSchema = z
  .object({
    '.id': z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    mtu: z.string().optional(),
    'mac-address': z.string().optional(),
    running: z.enum(['true', 'false']).optional(),
    disabled: z.enum(['true', 'false']).optional(),
  })
  .passthrough()
export type InterfaceRecord = z.infer<typeof InterfaceRecordSchema>

export const InterfaceTrafficSchema = z.object({
  iface: z.string(),
  rx: z.number(),
  tx: z.number(),
  rx_packets: z.number().optional(),
  tx_packets: z.number().optional(),
  timestamp: z.string().optional(),
})
export type InterfaceTraffic = z.infer<typeof InterfaceTrafficSchema>

export const QueueRecordSchema = z
  .object({
    '.id': z.string(),
    name: z.string().optional(),
    target: z.string().optional(),
    'max-limit': z.string().optional(),
    'burst-limit': z.string().optional(),
    disabled: z.enum(['true', 'false']).optional(),
  })
  .passthrough()
export type QueueRecord = z.infer<typeof QueueRecordSchema>

export const NATRuleRecordSchema = z
  .object({
    '.id': z.string(),
    chain: z.string().optional(),
    action: z.string().optional(),
    'out-interface': z.string().optional(),
    comment: z.string().optional(),
    disabled: z.enum(['true', 'false']).optional(),
  })
  .passthrough()
export type NATRuleRecord = z.infer<typeof NATRuleRecordSchema>

export const DHCPLeaseRecordSchema = z
  .object({
    '.id': z.string(),
    address: z.string().optional(),
    'mac-address': z.string().optional(),
    'host-name': z.string().optional(),
    server: z.string().optional(),
    status: z
      .enum(['bound', 'waiting', 'busy', 'offered', 'expired'])
      .optional(),
  })
  .passthrough()
export type DHCPLeaseRecord = z.infer<typeof DHCPLeaseRecordSchema>

export const PoolRecordSchema = z
  .object({
    '.id': z.string(),
    name: z.string().optional(),
    ranges: z.string().optional(),
  })
  .passthrough()
export type PoolRecord = z.infer<typeof PoolRecordSchema>

// SSE `event: stats` payloads from /stream/network/interfaces/stats and
// /stream/network/queues[/parents]/stats. Cumulative counters; the UI derives
// bps from deltas. Mirrors api/dto/stream.go InterfaceStatsEvent / QueueStatsEvent.
export type InterfaceStatsEvent = {
  id: string
  name: string
  type: string
  rx_byte: number
  tx_byte: number
  rx_packet: number
  tx_packet: number
  running: boolean
  disabled: boolean
}

export type QueueStatsEvent = {
  id: string
  name: string
  target: string
  parent?: string
  disabled: boolean
  dynamic: boolean
  comment?: string
  bytes: string // "upload/download" cumulative
  rate?: string // "upload/download" instant bps
  max_limit?: string
}

// Historis: HistoryRow adalah map dinamis (api/dto/history.go). Kolom relevan:
//   interfaces: { time, iface, rx_delta, tx_delta }
//   queues:     { time, queue, bytes_in_delta, bytes_out_delta }
export type HistoryRow = Record<string, unknown>

export type HistoryRange = {
  from: string // RFC3339
  to: string // RFC3339
  interval: string // Go duration, mis. "30s"
}

// Mirror of docs/openapi/components/schemas/sse.yaml#/TelemetryEvent
export const TrafficTelemetryEventSchema = z.object({
  measurement: z.string(),
  tags: z.record(z.string(), z.string()),
  fields: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
})
export type TrafficTelemetryEvent = z.infer<typeof TrafficTelemetryEventSchema>
