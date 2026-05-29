import { useMemo } from 'react'
import { Loader2, Plus, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { useRouters } from './api/queries'
import { RoutersTable } from './components/routers-table'
import { RoutersDialogs } from './dialogs/routers-dialogs'
import { useRoutersDialogStore } from './store/routers-dialog-store'

export function RoutersPage() {
  const openDialog = useRoutersDialogStore((s) => s.open)
  const { data, isLoading, isError, error, isFetching, refetch } = useRouters()

  const routers = useMemo(() => data ?? [], [data])
  const total = routers.length
  const connected = routers.filter((r) => r.status === 'connected').length
  const errors = routers.filter((r) => r.status === 'error' || r.status === 'disconnected').length

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>Routers</h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Manage your MikroTik router connections.
            </p>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => refetch()}
              disabled={isFetching}
              className='gap-1.5'
            >
              {isFetching ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <RefreshCw className='size-4' />
              )}
              Refresh
            </Button>
            <Button
              size='sm'
              className='gap-1.5'
              onClick={() => openDialog('create')}
            >
              <Plus className='size-4' />
              Add Router
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          <SummaryCard
            label='Total'
            value={total}
            icon={<Server className='size-4 text-foreground' />}
          />
          <SummaryCard
            label='Connected'
            value={connected}
            icon={<Wifi className='size-4 text-emerald-500' />}
          />
          <SummaryCard
            label='Issues'
            value={errors}
            icon={<WifiOff className='size-4 text-red-500' />}
          />
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center rounded-md border py-10 text-sm text-muted-foreground'>
            <Loader2 className='mr-2 size-4 animate-spin' />
            Loading routers…
          </div>
        ) : isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load routers{error?.message ? `: ${error.message}` : '.'} Click Refresh to retry.
          </div>
        ) : (
          <RoutersTable data={routers} />
        )}
      </Main>

      <RoutersDialogs />
    </>
  )
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className='flex items-center justify-between gap-2 px-4 py-3'>
        <div>
          <p className='text-[11px] uppercase text-muted-foreground'>{label}</p>
          <p className='text-2xl font-bold tabular-nums'>{value}</p>
        </div>
        <div className='rounded-full bg-muted p-2'>{icon}</div>
      </CardContent>
    </Card>
  )
}
