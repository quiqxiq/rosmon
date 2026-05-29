import { Loader2, RefreshCw, ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { usePPPActive, usePPPActiveStream } from './api/queries'
import { PPPActiveTable } from './components/ppp-active-table'

export function PPPActive() {
  const routerId = useActiveRouterId()
  const activeQuery = usePPPActive(routerId ?? 0)
  const sse = usePPPActiveStream(routerId ?? 0)

  const sessions = activeQuery.data ?? []

  const handleRefresh = () => {
    activeQuery.refetch()
    toast.info('Refreshing sessions…')
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view active PPP sessions.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div className='space-y-1'>
          <div className='flex items-center gap-2'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              PPP Active
            </h2>
            <LiveIndicator status={sse.status} />
          </div>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {sessions.length} active session{sessions.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={activeQuery.isFetching}
          className='gap-1.5'
        >
          {activeQuery.isFetching ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <RefreshCw className='size-4' />
          )}
          Refresh
        </Button>
      </div>
      {activeQuery.isError ? (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
          Failed to load active sessions. Click Refresh to retry.
        </div>
      ) : (
        <PPPActiveTable data={sessions} />
      )}
    </Main>
  )
}

function LiveIndicator({
  status,
}: {
  status: 'idle' | 'connecting' | 'open' | 'closed'
}) {
  const color =
    status === 'open'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40'
  const label =
    status === 'open'
      ? 'live'
      : status === 'connecting'
        ? 'connecting'
        : 'offline'
  return (
    <span
      className='inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground'
      title={`SSE: ${status}`}
    >
      <span
        className={`inline-block size-2 rounded-full ${color} ${
          status === 'open' ? 'animate-pulse' : ''
        }`}
      />
      {label}
    </span>
  )
}
