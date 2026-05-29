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

// Mirror of docs/openapi/components/schemas/sse.yaml#/TelemetryEvent
export const TrafficTelemetryEventSchema = z.object({
  measurement: z.string(),
  tags: z.record(z.string(), z.string()),
  fields: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
})
export type TrafficTelemetryEvent = z.infer<typeof TrafficTelemetryEventSchema>
