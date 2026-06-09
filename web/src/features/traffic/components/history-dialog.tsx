import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getAPIErrorCode } from '@/lib/api/errors'
import { useInterfaceHistory, useQueueHistory } from '../api/queries'
import { HISTORY_RANGES, type TrafficSample } from '../data/schema'
import type { HistoryRange, HistoryRow } from '../api/schema'
import { TrafficChart } from './traffic-chart'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  routerId: number
  kind: 'interface' | 'queue'
  name: string
}

// "30s" | "2m" | "10m" → detik
function durationSeconds(d: string): number {
  const m = d.match(/^(\d+)([smh])$/)
  if (!m) return 60
  const n = Number(m[1])
  return m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n
}

// Kolom `time` dari InfluxDB datang sebagai epoch nanoseconds (number besar,
// ~1.78e18). Konversi ke epoch ms untuk Date. Toleran terhadap ms/RFC3339.
function rowTimeMs(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isFinite(n) && n > 0) return n > 1e15 ? Math.round(n / 1e6) : n
  return new Date(String(v)).getTime()
}

export function HistoryDialog({
  open,
  onOpenChange,
  routerId,
  kind,
  name,
}: Props) {
  const [rangeIdx, setRangeIdx] = useState(0)
  const preset = HISTORY_RANGES[rangeIdx]

  const range: HistoryRange | null = useMemo(() => {
    if (!open) return null
    const to = new Date()
    const from = new Date(to.getTime() - preset.seconds * 1000)
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      interval: preset.interval,
    }
  }, [open, preset])

  const ifaceQuery = useInterfaceHistory(
    kind === 'interface' ? routerId : 0,
    kind === 'interface' ? range : null,
  )
  const queueQuery = useQueueHistory(
    kind === 'queue' ? routerId : 0,
    kind === 'queue' ? range : null,
  )
  const query = kind === 'interface' ? ifaceQuery : queueQuery

  const samples: TrafficSample[] = useMemo(() => {
    const rows = (query.data ?? []) as HistoryRow[]
    const intervalSec = durationSeconds(preset.interval)
    const nameCol = kind === 'interface' ? 'iface' : 'queue'
    const rxCol = kind === 'interface' ? 'rx_delta' : 'bytes_in_delta'
    const txCol = kind === 'interface' ? 'tx_delta' : 'bytes_out_delta'
    return rows
      .filter((r) => String(r[nameCol] ?? '') === name)
      .map((r) => {
        const ts = rowTimeMs(r.time)
        const rxBytes = Number(r[rxCol]) || 0
        const txBytes = Number(r[txCol]) || 0
        return {
          timestamp: ts,
          rxBps: (rxBytes * 8) / intervalSec,
          txBps: (txBytes * 8) / intervalSec,
          rxPps: 0,
          txPps: 0,
        }
      })
      .filter((s) => !isNaN(s.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [query.data, preset.interval, kind, name])

  // Backend balas 503 {code:"INFLUX_DISABLED"} saat Influx mati.
  const influxOff =
    query.isError && getAPIErrorCode(query.error) === 'INFLUX_DISABLED'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[96vw] max-w-3xl'>
        <DialogHeader>
          <DialogTitle className='font-mono text-base'>{name}</DialogTitle>
          <DialogDescription>
            Histori traffic ({kind === 'interface' ? 'interface' : 'queue'}) dari
            InfluxDB.
          </DialogDescription>
        </DialogHeader>

        <div className='flex gap-1.5'>
          {HISTORY_RANGES.map((r, i) => (
            <Button
              key={r.label}
              type='button'
              size='sm'
              variant={i === rangeIdx ? 'secondary' : 'ghost'}
              className='h-7 px-2.5 text-xs'
              onClick={() => setRangeIdx(i)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className='min-h-[320px]'>
          {query.isLoading ? (
            <div className='flex h-[320px] items-center justify-center text-sm text-muted-foreground'>
              <Loader2 className='mr-2 size-4 animate-spin' />
              Memuat histori…
            </div>
          ) : influxOff ? (
            <div className='flex h-[320px] flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground'>
              <span className='font-medium text-foreground'>
                InfluxDB belum aktif
              </span>
              Aktifkan InfluxDB (INFLUX_ENABLED=true) untuk melihat data historis.
            </div>
          ) : query.isError ? (
            <div className='flex h-[320px] items-center justify-center text-sm text-destructive'>
              Gagal memuat histori.
            </div>
          ) : samples.length === 0 ? (
            <div className='flex h-[320px] items-center justify-center text-sm text-muted-foreground'>
              Belum ada data pada rentang ini.
            </div>
          ) : (
            <TrafficChart samples={samples} mode='history' />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
