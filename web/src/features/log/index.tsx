import { useMemo, useRef, useState, useEffect } from 'react'
import { Pause, Play, ServerOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useLogBacklog, useLogStream } from './api/queries'
import { LogTable } from './components/log-table'
import { LogToolbar } from './components/log-toolbar'
import { filterLogs, LOG_MAX_ENTRIES, restLogToLogEntry } from './data/data'
import { type LogEntry } from './data/schema'
import type { SSEStatus } from '@/lib/api/sse'

// ── Status badge ──────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────

export function Log() {
  const routerId = useActiveRouterId() ?? 0

  const [entries, setEntries] = useState<LogEntry[]>([])
  const [search, setSearch] = useState('')
  const [topics, setTopics] = useState<string[]>([])
  const [paused, setPaused] = useState(false)

  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  // Backlog buffer via REST (seed awal); SSE follow menambah entri baru di atas.
  // Filter topic dilakukan client-side (filterLogs) — backlog & stream selalu
  // ambil semua. Seed dilakukan saat render (pola "adjust state on prop
  // change") agar tidak memicu cascading render / lint react-compiler.
  const backlog = useLogBacklog(routerId)
  const [seededData, setSeededData] = useState<unknown>(null)
  if (backlog.data && backlog.data !== seededData) {
    setSeededData(backlog.data)
    setEntries(backlog.data.map(restLogToLogEntry).slice(0, LOG_MAX_ENTRIES))
  }

  const { status } = useLogStream(routerId, (entry) => {
    if (pausedRef.current) return
    setEntries((prev) => {
      const next = [entry, ...prev]
      return next.length > LOG_MAX_ENTRIES ? next.slice(0, LOG_MAX_ENTRIES) : next
    })
  })

  const filtered = useMemo(
    () => filterLogs(entries, search, topics),
    [entries, search, topics],
  )

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>System Log</h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {routerId > 0
              ? `Live RouterOS log stream · capped at ${LOG_MAX_ENTRIES} entries`
              : 'Select a router in the sidebar to begin.'}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <StatusBadge status={status} />
          {routerId > 0 && (
            <>
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
              <Button
                variant='outline'
                size='sm'
                className='gap-1.5'
                onClick={() => setEntries([])}
              >
                <Trash2 className='size-4' />
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {routerId === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-md border py-16 text-center text-sm text-muted-foreground'>
          <ServerOff className='mb-2 size-8 opacity-60' />
          No router selected — use the sidebar switcher to pick one.
        </div>
      ) : (
        <Card>
          <CardContent className='flex flex-col gap-3 pt-6'>
            <LogToolbar
              search={search}
              onSearchChange={setSearch}
              selectedTopics={topics}
              onTopicsChange={setTopics}
              totalShown={filtered.length}
              totalAll={entries.length}
            />
            <LogTable entries={filtered} />
          </CardContent>
        </Card>
      )}
    </Main>
  )
}
