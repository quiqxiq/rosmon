import { useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Play, RefreshCw, ServerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useInterfaces, useTrafficStream } from './api/queries'
import { InterfaceSelect } from './components/interface-select'
import { TrafficChart } from './components/traffic-chart'
import { TrafficModeToggle } from './components/traffic-mode-toggle'
import { TrafficStatsRow } from './components/traffic-stats-row'
import { HISTORY_MAX, LIVE_MAX_POINTS, interfaceToNetInterface } from './data/data'
import { type NetInterface, type TrafficMode, type TrafficSample } from './data/schema'
import type { SSEStatus } from '@/lib/api/sse'

// ── Status badge ──────────────────────────────────────────────────────────

const statusConfig: Record<SSEStatus, { label: string; dot: string }> = {
  idle: { label: 'No interface', dot: 'bg-muted-foreground/50' },
  connecting: { label: 'Connecting…', dot: 'bg-amber-400 animate-pulse' },
  open: { label: 'Live', dot: 'bg-emerald-500 animate-pulse' },
  closed: { label: 'Reconnecting…', dot: 'bg-red-500' },
}

function StatusBadge({ status }: { status: SSEStatus }) {
  const cfg = statusConfig[status]
  return (
    <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
      <span className={cn('size-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

// ── Top-level page ────────────────────────────────────────────────────────

export function Traffic() {
  const routerId = useActiveRouterId() ?? 0
  const { data: ifaceRecords, isLoading, isError, refetch } = useInterfaces(routerId)

  const interfaces: NetInterface[] = (ifaceRecords ?? []).map(interfaceToNetInterface)
  const runningCount = interfaces.filter((i) => i.running && !i.disabled).length

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>Traffic Monitor</h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {routerId > 0
              ? isLoading
                ? 'Loading interfaces…'
                : `${runningCount} of ${interfaces.length} interfaces running`
              : 'Select a router in the sidebar to begin.'}
          </p>
        </div>
        {routerId > 0 && (
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <RefreshCw className='size-4' />
            )}
            Refresh
          </Button>
        )}
      </div>

      {routerId === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-md border py-16 text-center text-sm text-muted-foreground'>
          <ServerOff className='mb-2 size-8 opacity-60' />
          No router selected — use the sidebar switcher to pick one.
        </div>
      ) : isLoading ? (
        <div className='flex items-center justify-center rounded-md border py-12 text-sm text-muted-foreground'>
          <Loader2 className='mr-2 size-4 animate-spin' />
          Loading interfaces…
        </div>
      ) : isError ? (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive'>
          Failed to load interfaces.{' '}
          <button onClick={() => refetch()} className='underline'>
            Retry
          </button>
        </div>
      ) : interfaces.length === 0 ? (
        <div className='flex items-center justify-center rounded-md border py-12 text-sm text-muted-foreground'>
          No interfaces found on this router.
        </div>
      ) : (
        <TrafficPanel routerId={routerId} interfaces={interfaces} />
      )}
    </Main>
  )
}

// ── Traffic panel ─────────────────────────────────────────────────────────

type TrafficPanelProps = {
  routerId: number
  interfaces: NetInterface[]
}

function TrafficPanel({ routerId, interfaces }: TrafficPanelProps) {
  const firstRunning =
    interfaces.find((i) => i.running && !i.disabled)?.name ?? interfaces[0]?.name ?? ''

  const [selectedIface, setSelectedIface] = useState(firstRunning)
  const [mode, setMode] = useState<TrafficMode>('live')
  const [paused, setPaused] = useState(false)
  const [samples, setSamples] = useState<TrafficSample[]>([])

  // Stable ref so the SSE callback always reads the latest paused value
  // without causing a reconnect on each render.
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  // Clear samples when the selected interface changes.
  const prevIfaceRef = useRef(selectedIface)
  useEffect(() => {
    if (prevIfaceRef.current !== selectedIface) {
      prevIfaceRef.current = selectedIface
      setSamples([])
    }
  }, [selectedIface])

  const { status } = useTrafficStream(routerId, selectedIface, (sample) => {
    if (pausedRef.current) return
    setSamples((prev) => {
      const next = [...prev, sample]
      return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next
    })
  })
  console.log('Traffic stream status:', samples)

  const displaySamples =
    mode === 'live' ? samples.slice(-LIVE_MAX_POINTS) : samples
  const current = displaySamples[displaySamples.length - 1] ?? null

  const selectedInterface = interfaces.find((i) => i.name === selectedIface)

  return (
    <Card>
      <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <InterfaceSelect
            interfaces={interfaces}
            value={selectedIface}
            onChange={(name) => {
              setSelectedIface(name)
              setPaused(false)
            }}
          />
          <TrafficModeToggle mode={mode} onChange={setMode} />
          {mode === 'live' && (
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? (
                <>
                  <Play className='size-4' />
                  Resume
                </>
              ) : (
                <>
                  <Pause className='size-4' />
                  Pause
                </>
              )}
            </Button>
          )}
        </div>
        <div className='flex items-center gap-3'>
          <StatusBadge status={status} />
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            title='Reset chart'
            onClick={() => setSamples([])}
          >
            <RefreshCw className='size-3.5' />
          </Button>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col gap-4'>
        <TrafficStatsRow current={current} samples={displaySamples} />

        <Card>
          <CardHeader className='pb-2'>
            <span className='font-mono text-sm font-medium'>
              {selectedInterface?.name ?? selectedIface}
              {selectedInterface?.comment && (
                <span className='ml-2 text-xs font-normal text-muted-foreground'>
                  {selectedInterface.comment}
                </span>
              )}
            </span>
          </CardHeader>
          <CardContent>
            {displaySamples.length === 0 ? (
              <div className='flex h-[360px] items-center justify-center text-sm text-muted-foreground'>
                {status === 'connecting' || status === 'open'
                  ? 'Waiting for data…'
                  : 'No data — check router connection.'}
              </div>
            ) : (
              <TrafficChart samples={displaySamples} mode={mode} />
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  )
}
