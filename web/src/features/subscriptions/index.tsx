import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useCustomers } from '@/features/customers/api/queries'
import { useSubscriptions } from './api/queries'
import { makeColumns } from './components/columns'
import { SubscriptionMutateDrawer } from './dialogs/subscription-mutate-drawer'
import { StatusDialog } from './dialogs/status-dialog'
import { useSubscriptionsDialogStore } from './store/dialog-store'

export function Subscriptions() {
  const subsQuery = useSubscriptions()
  const customersQuery = useCustomers()
  const openDialog = useSubscriptionsDialogStore((s) => s.open)

  const customerName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of customersQuery.data ?? []) map.set(c.id, c.full_name)
    return (id: number) => map.get(id) ?? `#${id}`
  }, [customersQuery.data])

  const columns = useMemo(() => makeColumns(customerName), [customerName])

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Subscriptions
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {(subsQuery.data ?? []).length} subscription
              {(subsQuery.data ?? []).length === 1 ? '' : 's'}
            </p>
          </div>
          <Button size='sm' className='gap-1.5' onClick={() => openDialog('add')}>
            <Plus className='size-4' />
            New Subscription
          </Button>
        </div>
        {subsQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load subscriptions.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={subsQuery.data ?? []}
            searchKey='mikrotik_username'
            searchPlaceholder='Search by username...'
            filters={[
              {
                columnId: 'service_type',
                title: 'Service',
                options: [
                  { label: 'PPPoE', value: 'pppoe' },
                  { label: 'Hotspot', value: 'hotspot' },
                ],
              },
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Active', value: 'active' },
                  { label: 'Pending', value: 'pending_install' },
                  { label: 'Isolir', value: 'isolir' },
                  { label: 'Suspended', value: 'suspended' },
                  { label: 'Terminated', value: 'terminated' },
                ],
              },
            ]}
            emptyMessage='No subscriptions yet.'
          />
        )}
      </Main>
      <SubscriptionMutateDrawer />
      <StatusDialog />
    </>
  )
}
