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

// LiveEntity = satu baris grid (interface atau queue) dengan rate live yang
// sudah dihitung dari delta byte, plus ring-buffer kecil untuk sparkline.
export type LiveSpark = { t: number; rx: number; tx: number }
export type LiveEntity = {
  key: string
  title: string
  subtitle: string
  running: boolean
  disabled: boolean
  rxBps: number // download / ke-target
  txBps: number // upload / dari-target
  maxLimit?: string
  parent?: string // queue only — untuk memisah parent vs child
  spark: LiveSpark[]
}

export type LiveKind = 'interfaces' | 'parents' | 'queues'

// Range historis untuk dialog (klik kartu). interval menyesuaikan rentang
// supaya jumlah titik wajar.
export type HistoryRangePreset = {
  label: string
  seconds: number
  interval: string
}
export const HISTORY_RANGES: HistoryRangePreset[] = [
  { label: '1 jam', seconds: 3600, interval: '30s' },
  { label: '6 jam', seconds: 21600, interval: '2m' },
  { label: '24 jam', seconds: 86400, interval: '10m' },
]
