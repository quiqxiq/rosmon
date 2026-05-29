import { z } from 'zod'

export type NetInterface = {
  id: string
  name: string
  type: string
  mtu: string
  macAddress?: string
  running: boolean
  disabled: boolean
  comment: string
}

export const trafficSampleSchema = z.object({
  timestamp: z.number(),
  rxBps: z.number(),
  txBps: z.number(),
  rxPps: z.number(),
  txPps: z.number(),
})
export type TrafficSample = z.infer<typeof trafficSampleSchema>

export type TrafficMode = 'live' | 'history'
