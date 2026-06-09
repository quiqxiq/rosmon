import { useMemo } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { useCustomers } from '@/features/customers/api/queries'
import { useSubscriptions } from './api/queries'
import { SubscriptionsDialogs } from './components/subscriptions-dialogs'
import { SubscriptionsPrimaryButtons } from './components/subscriptions-primary-buttons'
import { SubscriptionsProvider } from './components/subscriptions-provider'
import { SubscriptionsTable } from './components/subscriptions-table'
import { subscriptionsColumns } from './components/subscriptions-columns'

const route = getRouteApi('/_authenticated/subscriptions/')

export function Subscriptions() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const subsQuery = useSubscriptions()
  const customersQuery = useCustomers()

  const customerName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of customersQuery.data ?? []) {
      map.set(c.id, c.full_name)
    }
    return (id: number) => map.get(id) ?? `#${id}`
  }, [customersQuery.data])

  const columns = useMemo(() => subscriptionsColumns(customerName), [customerName])
  const data = subsQuery.data ?? []

  return (
    <SubscriptionsProvider>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Subscriptions
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Manage your subscriptions here.
            </p>
          </div>
          <SubscriptionsPrimaryButtons />
        </div>
        {subsQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load subscriptions.
          </div>
        ) : (
          <SubscriptionsTable
            data={data}
            columns={columns}
            search={search}
            navigate={navigate}
            customerName={customerName}
          />
        )}
      </Main>

      <SubscriptionsDialogs />
    </SubscriptionsProvider>
  )
}
