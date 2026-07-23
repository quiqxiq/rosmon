import { useMemo } from 'react'
import { Loader2, Plus, RefreshCw, ShieldCheck, UserCog } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { useAdminUsers } from './api/queries'
import { AdminUsersTable } from './components/admin-users-table'
import { AdminUserDialogs } from './dialogs/admin-user-dialogs'
import { useAdminUsersDialogStore } from './store/admin-users-dialog-store'

export function AdminUsers() {
  const openDialog = useAdminUsersDialogStore((s) => s.open)
  const role = useAuthStore((s) => s.auth.user?.role)
  const isAdmin = role === 'admin'
  const { data, isLoading, isError, error, isFetching, refetch } =
    useAdminUsers()

  // Sort once per data change so the UI is deterministic. Active users
  // first (so disabled accounts sink to the bottom), then alphabetical.
  const sorted = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.username.localeCompare(b.username)
    })
  }, [data])

  const total = sorted.length
  const adminCount = sorted.filter((u) => u.role === 'admin').length
  const activeCount = sorted.filter((u) => u.active).length

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Admin Users
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Manage sign-in accounts for this Roskit instance.
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
            {isAdmin && (
              <Button
                size='sm'
                className='gap-1.5'
                onClick={() => openDialog('add')}
              >
                <Plus className='size-4' />
                Add User
              </Button>
            )}
          </div>
        </div>

        <div className='grid grid-cols-3 gap-3'>
          <SummaryCard
            label='Total'
            value={total}
            icon={<UserCog className='size-4 text-foreground' />}
          />
          <SummaryCard
            label='Admins'
            value={adminCount}
            icon={<ShieldCheck className='size-4 text-violet-500' />}
          />
          <SummaryCard
            label='Active'
            value={activeCount}
            icon={
              <span className='size-2.5 rounded-full bg-emerald-500' />
            }
          />
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center rounded-md border py-10 text-sm text-muted-foreground'>
            <Loader2 className='mr-2 size-4 animate-spin' />
            Loading admin users…
          </div>
        ) : isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load admin users
            {error?.message ? `: ${error.message}` : '.'} Click Refresh to retry.
          </div>
        ) : (
          <AdminUsersTable data={sorted} />
        )}
      </Main>
      <AdminUserDialogs />
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
