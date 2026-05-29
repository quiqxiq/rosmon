import { useMemo } from 'react'
import { Link2, Loader2, RefreshCw, ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { useHotspotHosts } from './api/queries'
import { HotspotHostsTable } from './components/hotspot-hosts-table'
import { toHostViewModel } from './components/view-model'
import { HostDialogs } from './dialogs/host-dialogs'
import { useHostsDialogStore } from './store/hosts-dialog-store'

export function HotspotHosts() {
  const routerId = useActiveRouterId()
  const hostsQuery = useHotspotHosts(routerId ?? 0)
  const openDialog = useHostsDialogStore((s) => s.open)

  const viewModels = useMemo(
    () => (hostsQuery.data ?? []).map(toHostViewModel),
    [hostsQuery.data],
  )
  const totalCount = viewModels.length
  const authorizedCount = viewModels.filter((h) => h.authorized).length

  const handleRefresh = () => {
    hostsQuery.refetch()
    toast.info('Refreshing hosts…')
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its hotspot hosts.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Hosts
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {totalCount} total · {authorizedCount} authorized
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            disabled={hostsQuery.isFetching}
            className='gap-1.5'
          >
            {hostsQuery.isFetching ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <RefreshCw className='size-4' />
            )}
            Refresh
          </Button>
          <Button
            size='sm'
            className='gap-1.5'
            onClick={() => openDialog('bind')}
          >
            <Link2 className='size-4' />
            Make IP Binding
          </Button>
        </div>
      </div>
      {hostsQuery.isError ? (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
          Failed to load hosts. Click Refresh to retry.
        </div>
      ) : (
        <HotspotHostsTable data={viewModels} />
      )}
      <HostDialogs />
    </Main>
  )
}
