import { useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { parseAPIError } from '@/lib/api/errors'
import { useHotspotDbProfiles, useSyncHotspotDbProfiles } from './api/queries'
import { makeColumns } from './components/columns'
import { HotspotBillingMutateDrawer } from './dialogs/mutate-drawer'
import { useHotspotBillingDialogStore } from './store/dialog-store'

export function HotspotBilling() {
  const routerId = useActiveRouterId()
  const rid = routerId ?? 0
  const profilesQuery = useHotspotDbProfiles(rid)
  const syncMutation = useSyncHotspotDbProfiles(rid)
  const openDialog = useHotspotBillingDialogStore((s) => s.open)
  const [syncing, setSyncing] = useState(false)

  const columns = useMemo(() => makeColumns(rid), [rid])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await syncMutation.mutateAsync(undefined)
      toast.success('Sync complete', {
        description: `${res.synced.length} synced · ${res.created.length} created · ${res.orphan.length} orphan`,
      })
    } catch (err) {
      toast.error('Sync failed', { description: parseAPIError(err) })
    } finally {
      setSyncing(false)
    }
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router to manage hotspot billing profiles.
        </p>
      </Main>
    )
  }

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Hotspot Billing Profiles
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {(profilesQuery.data ?? []).length} profile
              {(profilesQuery.data ?? []).length === 1 ? '' : 's'} · voucher &
              permanent plans
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleSync}
              disabled={syncing}
              className='gap-1.5'
            >
              {syncing ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <RefreshCw className='size-4' />
              )}
              Sync from Router
            </Button>
            <Button size='sm' className='gap-1.5' onClick={() => openDialog('add')}>
              <Plus className='size-4' />
              Add Profile
            </Button>
          </div>
        </div>
        {profilesQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load hotspot billing profiles.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={profilesQuery.data ?? []}
            searchKey='name'
            searchPlaceholder='Search profiles...'
            filters={[
              {
                columnId: 'role',
                title: 'Role',
                options: [
                  { label: 'Voucher', value: 'voucher' },
                  { label: 'Permanent', value: 'permanent' },
                ],
              },
            ]}
            emptyMessage='No billing profiles. Use Sync to import from the router.'
          />
        )}
      </Main>
      <HotspotBillingMutateDrawer />
    </>
  )
}
