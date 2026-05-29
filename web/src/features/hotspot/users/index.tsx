import { useMemo } from 'react'
import { Download, Loader2, RefreshCw, ServerOff, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { exportHotspotUsersCSV } from './api/service'
import {
  useHotspotUsers,
  useHotspotUsersStream,
} from './api/queries'
import { HotspotUsersTable } from './components/hotspot-users-table'
import { toUserViewModel } from './components/view-model'
import { UserDialogs } from './dialogs/user-dialogs'
import { useUsersDialogStore } from './store/users-dialog-store'

export function HotspotUsers() {
  const routerId = useActiveRouterId()
  const usersQuery = useHotspotUsers(routerId ?? 0)
  // SSE drives the live indicator + auto-refresh. Connects only when a
  // router is selected; `useSSE` handles the parked state when the id
  // is null.
  const sse = useHotspotUsersStream(routerId ?? 0)
  const openDialog = useUsersDialogStore((s) => s.open)

  // Build view models once per query result. `now` captured here so the
  // expired-flag is consistent across all rows for this render.
  const viewModels = useMemo(() => {
    const now = new Date()
    return (usersQuery.data ?? []).map((u) => toUserViewModel(u, now))
  }, [usersQuery.data])

  const totalCount = viewModels.length
  const disabledCount = viewModels.filter(
    (u) => u.enabledStatus === 'disabled',
  ).length
  const expiredCount = viewModels.filter((u) => u.expiry?.isPast).length

  const handleRefresh = () => {
    usersQuery.refetch()
    toast.info('Refreshing users…')
  }

  const handleExport = async () => {
    if (routerId == null) return
    try {
      const blob = await exportHotspotUsersCSV(routerId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hotspot-users-${routerId}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Exported hotspot users CSV')
    } catch (err) {
      toast.error('Failed to export users', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its hotspot users.
        </p>
      </Main>
    )
  }

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
                Hotspot Users
              </h2>
              <LiveIndicator status={sse.status} />
            </div>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {totalCount} total · {disabledCount} disabled · {expiredCount} expired
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={usersQuery.isFetching}
              className='gap-1.5'
            >
              {usersQuery.isFetching ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <RefreshCw className='size-4' />
              )}
              Refresh
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleExport}
              className='gap-1.5'
            >
              <Download className='size-4' />
              Export
            </Button>
            <Button
              size='sm'
              className='gap-1.5'
              onClick={() => openDialog('add')}
            >
              <UserPlus className='size-4' />
              Add User
            </Button>
          </div>
        </div>
        {usersQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load hotspot users. Click Refresh to retry.
          </div>
        ) : (
          <HotspotUsersTable data={viewModels} />
        )}
      </Main>
      <UserDialogs />
    </>
  )
}

// Small connection dot. Pulsing green while the SSE stream is open,
// amber while reconnecting, grey otherwise. Title attribute spells out
// the state for keyboard / screen-reader users.
function LiveIndicator({ status }: { status: 'idle' | 'connecting' | 'open' | 'closed' }) {
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
