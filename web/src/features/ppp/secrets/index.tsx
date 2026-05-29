import { Loader2, RefreshCw, ServerOff, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { usePPPSecrets } from './api/queries'
import { PPPSecretsTable } from './components/ppp-secrets-table'
import { SecretDialogs } from './dialogs/secret-dialogs'
import { useSecretsDialogStore } from './store/secrets-dialog-store'

export function PPPSecrets() {
  const routerId = useActiveRouterId()
  const secretsQuery = usePPPSecrets(routerId ?? 0)
  const openDialog = useSecretsDialogStore((s) => s.open)

  const secrets = secretsQuery.data ?? []
  const totalCount = secrets.length
  const disabledCount = secrets.filter((s) => s.disabled).length

  const handleRefresh = () => {
    secretsQuery.refetch()
    toast.info('Refreshing secrets…')
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its PPP secrets.
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
              PPP Secrets
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {totalCount} total · {disabledCount} disabled
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={secretsQuery.isFetching}
              className='gap-1.5'
            >
              {secretsQuery.isFetching ? (
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
              <UserPlus className='size-4' />
              Add Secret
            </Button>
          </div>
        </div>
        {secretsQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load PPP secrets. Click Refresh to retry.
          </div>
        ) : (
          <PPPSecretsTable data={secrets} />
        )}
      </Main>
      <SecretDialogs />
    </>
  )
}
