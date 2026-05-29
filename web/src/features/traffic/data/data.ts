import { type InterfaceRecord } from '../api/schema'
import { type NetInterface, type TrafficSample } from './schema'

export const LIVE_MAX_POINTS = 120  // ~2 min at 1 event/sec
export const HISTORY_MAX = 3_600    // cap session buffer at 1h

export function emptySample(timestamp: number): TrafficSample {
  return { timestamp, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0 }
}

/**
 * Maps an API InterfaceRecord to the UI-friendly NetInterface type.
 *
 * The RouterOS REST API returns booleans as the strings "true" / "false",
 * so the transformer normalises them to real booleans.  The API schema
 * uses `.passthrough()` so unknown fields such as `comment` pass through
 * the Zod parser and are available at runtime.
 */
export function interfaceToNetInterface(
  record: InterfaceRecord
): NetInterface {
  return {
    id: record['.id'],
    name: record.name ?? '',
    type: record.type ?? '',
    mtu: record.mtu ?? '',
    macAddress: record['mac-address'],
    running: record.running === 'true',
    disabled: record.disabled === 'true',
    comment: (record as Record<string, string>).comment ?? '',
  }
}

export function telemetryToTrafficSample(event: {
  fields: {
    rx_bits_per_second?: number
    tx_bits_per_second?: number
    rx_packets_per_second?: number
    tx_packets_per_second?: number
  }
  timestamp: string
}): TrafficSample {
  const ts = new Date(event.timestamp).getTime()
  return {
    timestamp: isNaN(ts) ? Date.now() : ts,
    rxBps: event.fields?.rx_bits_per_second ?? 0,
    txBps: event.fields?.tx_bits_per_second ?? 0,
    rxPps: event.fields?.rx_packets_per_second ?? 0,
    txPps: event.fields?.tx_packets_per_second ?? 0,
  }
}
