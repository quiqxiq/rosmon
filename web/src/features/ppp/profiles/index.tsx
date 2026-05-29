import { Loader2, Plus, RefreshCw, ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { usePPPProfiles } from './api/queries'
import { PPPProfilesTable } from './components/ppp-profiles-table'
import { ProfileDialogs } from './dialogs/profile-dialogs'
import { useProfilesDialogStore } from './store/profiles-dialog-store'

export function PPPProfiles() {
  const routerId = useActiveRouterId()
  const profilesQuery = usePPPProfiles(routerId ?? 0)
  const openDialog = useProfilesDialogStore((s) => s.open)

  const profiles = profilesQuery.data ?? []

  const handleRefresh = () => {
    profilesQuery.refetch()
    toast.info('Refreshing profiles…')
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view PPP profiles.
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
              PPP Profiles
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {profiles.length} profile{profiles.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={profilesQuery.isFetching}
              className='gap-1.5'
            >
              {profilesQuery.isFetching ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <RefreshCw className='size-4' />
              )}
              Refresh
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
            Failed to load PPP profiles. Click Refresh to retry.
          </div>
        ) : (
          <PPPProfilesTable data={profiles} />
        )}
      </Main>
      <ProfileDialogs />
    </>
  )
}
