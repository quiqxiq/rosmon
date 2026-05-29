import { useState } from 'react'
import { Loader2, Plus, RefreshCw, ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { parseAPIError } from '@/lib/api/errors'
import { usePPPDbProfiles, useSyncPPPDbProfiles } from './api/queries'
import { PPPBillingTable } from './components/ppp-billing-table'
import { DbProfileDialogs } from './dialogs/db-profile-dialogs'
import { useDbProfilesDialogStore } from './store/db-profiles-dialog-store'

export function PPPBilling() {
  const routerId = useActiveRouterId()
  const profilesQuery = usePPPDbProfiles(routerId ?? 0)
  const syncMutation = useSyncPPPDbProfiles(routerId ?? 0)
  const openDialog = useDbProfilesDialogStore((s) => s.open)
  const [syncing, setSyncing] = useState(false)

  const profiles = profilesQuery.data ?? []

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await syncMutation.mutateAsync()
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
          Select a router from the sidebar switcher to manage billing profiles.
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
              PPP Billing Profiles
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {profiles.length} profile{profiles.length === 1 ? '' : 's'} ·
              priced PPPoE plans
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
            <Button
              size='sm'
              className='gap-1.5'
              onClick={() => openDialog('add')}
            >
              <Plus className='size-4' />
              Add Profile
            </Button>
          </div>
        </div>
        {profilesQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load billing profiles. Retry from the sidebar.
          </div>
        ) : (
          <PPPBillingTable data={profiles} />
        )}
      </Main>
      <DbProfileDialogs />
    </>
  )
}
