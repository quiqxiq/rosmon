import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { useAuthStore } from '@/stores/auth-store'
import { useSSE, type UseSSEResult } from '@/lib/api/sse'
import * as svc from './service'
import type {
  HistoryRange,
  InterfaceStatsEvent,
  QueueStatsEvent,
  TrafficTelemetryEvent,
} from './schema'
import { telemetryToTrafficSample } from '../data/data'
import { type LiveEntity, type LiveKind, type TrafficSample } from '../data/schema'

// ─────────────────── REST queries ───────────────────

export function useInterfaces(routerId: number) {
  return useQuery({
    queryKey: qk.networkInterfaces(routerId),
    queryFn: () => svc.listInterfaces(routerId),
    enabled: routerId > 0,
  })
}

export function useQueues(routerId: number) {
  return useQuery({
    queryKey: qk.networkQueues(routerId),
    queryFn: () => svc.listQueues(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Historis (InfluxDB) ───────────────────

const rangeKey = (r: HistoryRange | null) =>
  r ? `${r.from}|${r.to}|${r.interval}` : ''

export function useInterfaceHistory(
  routerId: number,
  range: HistoryRange | null,
) {
  return useQuery({
    queryKey: qk.interfaceHistory(routerId, rangeKey(range)),
    queryFn: () => svc.getInterfaceHistory(routerId, range!),
    enabled: routerId > 0 && range !== null,
    retry: false, // 503 (Influx disabled) — jangan retry-spam
  })
}

export function useQueueHistory(routerId: number, range: HistoryRange | null) {
  return useQuery({
    queryKey: qk.queueHistory(routerId, rangeKey(range)),
    queryFn: () => svc.getQueueHistory(routerId, range!),
    enabled: routerId > 0 && range !== null,
    retry: false,
  })
}

// ─────────────────── Live grid (SSE `event: stats`) ───────────────────

// Filtering dilakukan server-side (di Go) dari satu stream per resource:
// interface per-type, queue parent (relasional). 'queues' tab tetap tampil
// semua lalu UI menyembunyikan parent (non-parent view).
const SSE_PATH: Record<LiveKind, (rid: number) => string> = {
  interfaces: (rid) =>
    `/devices/${rid}/stream/network/interfaces/stats?interval=1s&type=ether`,
  parents: (rid) =>
    `/devices/${rid}/stream/network/queues/parents/stats?interval=1s`,
  queues: (rid) => `/devices/${rid}/stream/network/queues/stats?interval=1s`,
}

const SPARK_MAX = 30

// "upload/download" → [upload, download]
function splitPair(s?: string): [number, number] {
  if (!s) return [0, 0]
  const [a, b] = s.split('/')
  return [Number(a) || 0, Number(b) || 0]
}

type Extracted = {
  key: string
  title: string
  subtitle: string
  running: boolean
  disabled: boolean
  rxBytes: number
  txBytes: number
  maxLimit?: string
  parent?: string
}

function extract(kind: LiveKind, raw: unknown): Extracted | null {
  if (kind === 'interfaces') {
    const e = raw as InterfaceStatsEvent
    if (!e?.name) return null
    if (e.type !== 'ether') return null // tab interfaces = ethernet saja
    return {
      key: e.name,
      title: e.name,
      subtitle: e.type,
      running: !!e.running,
      disabled: !!e.disabled,
      rxBytes: Number(e.rx_byte) || 0,
      txBytes: Number(e.tx_byte) || 0,
    }
  }
  // parents | queues — QueueStatsEvent. bytes "upload/download".
  const e = raw as QueueStatsEvent
  if (!e?.name) return null
  const [up, down] = splitPair(e.bytes)
  return {
    key: e.name,
    title: e.name,
    subtitle: e.target || '',
    running: !e.disabled,
    disabled: !!e.disabled,
    rxBytes: down, // download (ke target)
    txBytes: up, // upload (dari target)
    maxLimit: e.max_limit,
    parent: e.parent,
  }
}

export type UseLiveTrafficResult = {
  entities: LiveEntity[]
  status: UseSSEResult['status']
}

// useLiveTraffic membuka SSE stats stream untuk satu jenis (interfaces |
// parents | queues), menghitung rate bps dari delta byte antar event, dan
// mengembalikan daftar LiveEntity beserta ring-buffer sparkline.
export function useLiveTraffic(
  routerId: number,
  kind: LiveKind,
): UseLiveTrafficResult {
  // Pemanggil me-remount tab via key={routerId} saat router berganti, jadi
  // state akumulator di sini fresh per router — tak perlu reset manual.
  const [entities, setEntities] = useState<Map<string, LiveEntity>>(new Map())
  const prevRef = useRef<Map<string, { rx: number; tx: number; t: number }>>(
    new Map(),
  )

  const onEvent = useCallback(
    (raw: unknown) => {
      const x = extract(kind, raw)
      if (!x) return
      const now = Date.now()
      const prev = prevRef.current.get(x.key)
      let rxBps = 0
      let txBps = 0
      if (prev && now > prev.t) {
        const dt = (now - prev.t) / 1000
        rxBps = (Math.max(0, x.rxBytes - prev.rx) * 8) / dt
        txBps = (Math.max(0, x.txBytes - prev.tx) * 8) / dt
      }
      prevRef.current.set(x.key, { rx: x.rxBytes, tx: x.txBytes, t: now })
      setEntities((prevMap) => {
        const next = new Map(prevMap)
        const ex = next.get(x.key)
        const spark = [
          ...(ex?.spark ?? []),
          { t: now, rx: rxBps, tx: txBps },
        ].slice(-SPARK_MAX)
        next.set(x.key, {
          key: x.key,
          title: x.title,
          subtitle: x.subtitle,
          running: x.running,
          disabled: x.disabled,
          rxBps,
          txBps,
          maxLimit: x.maxLimit,
          parent: x.parent,
          spark,
        })
        return next
      })
    },
    [kind],
  )

  const { status } = useSSE<unknown>(
    routerId > 0 ? SSE_PATH[kind](routerId) : null,
    onEvent,
    { getToken: () => useAuthStore.getState().auth.accessToken, events: ['stats'] },
  )

  return { entities: [...entities.values()], status }
}

// ─────────────────── single-interface telemetry (dipakai history dialog: live preview) ───────────────────

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
      onSample(
        telemetryToTrafficSample(
          event as Parameters<typeof telemetryToTrafficSample>[0],
        ),
      )
    },
    {
      getToken: () => useAuthStore.getState().auth.accessToken,
      events: ['traffic'],
    },
  )
}
