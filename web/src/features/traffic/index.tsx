import { useMemo, useState } from 'react'
import { ServerOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useLiveTraffic } from './api/queries'
import { StatsGrid } from './components/stats-grid'
import { HistoryDialog } from './components/history-dialog'
import { type LiveEntity, type LiveKind } from './data/schema'
import type { SSEStatus } from '@/lib/api/sse'

const statusConfig: Record<SSEStatus, { label: string; dot: string }> = {
  idle: { label: 'No router', dot: 'bg-muted-foreground/50' },
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

export function Traffic() {
  const routerId = useActiveRouterId() ?? 0

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Traffic Monitor
        </h2>
        <p className='text-sm text-muted-foreground sm:text-base'>
          Real-time interface & queue throughput. Klik kartu untuk histori.
        </p>
      </div>

      {routerId === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-md border py-16 text-center text-sm text-muted-foreground'>
          <ServerOff className='mb-2 size-8 opacity-60' />
          No router selected — use the sidebar switcher to pick one.
        </div>
      ) : (
        <Tabs
          key={routerId}
          defaultValue='interfaces'
          className='flex flex-1 flex-col gap-4'
        >
          <TabsList>
            <TabsTrigger value='interfaces'>Interfaces</TabsTrigger>
            <TabsTrigger value='parents'>Parent Queues</TabsTrigger>
            <TabsTrigger value='queues'>Queues</TabsTrigger>
          </TabsList>

          <TabsContent value='interfaces'>
            <TrafficTab
              routerId={routerId}
              kind='interfaces'
              historyKind='interface'
              emptyHint='Tidak ada interface ethernet aktif.'
            />
          </TabsContent>
          <TabsContent value='parents'>
            <TrafficTab
              routerId={routerId}
              kind='parents'
              historyKind='queue'
              emptyHint='Tidak ada parent queue.'
            />
          </TabsContent>
          <TabsContent value='queues'>
            <TrafficTab
              routerId={routerId}
              kind='queues'
              historyKind='queue'
              emptyHint='Tidak ada queue (selain parent).'
              excludeParents
            />
          </TabsContent>
        </Tabs>
      )}
    </Main>
  )
}

type TrafficTabProps = {
  routerId: number
  kind: LiveKind
  historyKind: 'interface' | 'queue'
  emptyHint: string
  excludeParents?: boolean
}

function TrafficTab({
  routerId,
  kind,
  historyKind,
  emptyHint,
  excludeParents,
}: TrafficTabProps) {
  const { entities, status } = useLiveTraffic(routerId, kind)
  const [selected, setSelected] = useState<LiveEntity | null>(null)

  // Tab "Queues": sembunyikan queue yang menjadi parent (direferensikan
  // sebagai parent oleh queue lain) → tampilkan hanya non-parent.
  const shown = useMemo(() => {
    if (!excludeParents) return entities
    const parentNames = new Set(
      entities
        .map((e) => e.parent)
        .filter((p): p is string => !!p && p !== 'none' && p !== ''),
    )
    return entities.filter((e) => !parentNames.has(e.key))
  }, [entities, excludeParents])

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <span className='text-sm text-muted-foreground'>{shown.length} item</span>
        <StatusBadge status={status} />
      </div>
      <StatsGrid
        entities={shown}
        status={status}
        emptyHint={emptyHint}
        onSelect={setSelected}
      />
      <HistoryDialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        routerId={routerId}
        kind={historyKind}
        name={selected?.key ?? ''}
      />
    </div>
  )
}
