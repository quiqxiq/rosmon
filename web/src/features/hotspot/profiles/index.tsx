import { useMemo } from 'react'
import { Loader2, Plus, RefreshCw, ServerOff, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import {
  useHotspotProfiles,
  useSyncHotspotProfiles,
} from './api/queries'
import { HotspotProfilesTable } from './components/hotspot-profiles-table'
import { toProfileViewModel } from './components/view-model'
import { ProfileDialogs } from './dialogs/profile-dialogs'
import { useProfilesDialogStore } from './store/profiles-dialog-store'

export function HotspotProfiles() {
  const routerId = useActiveRouterId()
  const profilesQuery = useHotspotProfiles(routerId ?? 0)
  const syncMutation = useSyncHotspotProfiles(routerId ?? 0)
  const openDialog = useProfilesDialogStore((s) => s.open)
  const role = useAuthStore((s) => s.auth.user?.role)
  const isReadOnly = role === 'viewer'

  const viewModels = useMemo(
    () => (profilesQuery.data ?? []).map(toProfileViewModel),
    [profilesQuery.data],
  )

  const totalCount = viewModels.length
  const monitorCount = viewModels.filter((p) => p.hasExpiredMonitor).length

  const handleRefresh = () => {
    profilesQuery.refetch()
    toast.info('Refreshing profiles…')
  }

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (res) => {
        const orphanDetail =
          res.orphan.length > 0 ? ` · ${res.orphan.length} orphan (${res.orphan.join(', ')})` : ''
        toast.success('Profiles synced from RouterOS', {
          description: `${res.synced.length} synced · ${res.created.length} created${orphanDetail}`,
        })
      },
      onError: (err) => {
        toast.error('Failed to sync profiles', {
          description: err instanceof Error ? err.message : String(err),
        })
      },
    })
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its hotspot
          profiles.
        </p>
      </Main>
    )
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            User Profiles
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {totalCount} profiles · {monitorCount} with active expired monitor
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
            {!isReadOnly && (
              <>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className='gap-1.5'
                >
                  {syncMutation.isPending ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <Wand2 className='size-4' />
                  )}
                  Sync from RouterOS
                </Button>
                <Button
                  size='sm'
                  className='gap-1.5'
                  onClick={() => openDialog('add')}
                >
                  <Plus className='size-4' />
                  Add Profile
                </Button>
              </>
            )}
        </div>
      </div>
      {profilesQuery.isError ? (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
          Failed to load profiles. Click Refresh to retry.
        </div>
      ) : (
        <HotspotProfilesTable data={viewModels} />
      )}
      <ProfileDialogs />
    </Main>
  )
}
