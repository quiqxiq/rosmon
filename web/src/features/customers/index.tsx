import { getRouteApi } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { CustomersDialogs } from './components/customers-dialogs'
import { CustomersPrimaryButtons } from './components/customers-primary-buttons'
import { CustomersProvider } from './components/customers-provider'
import { CustomersTable } from './components/customers-table'
import { useCustomers } from './api/queries'

const route = getRouteApi('/_authenticated/customers/')

export function Customers() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const customersQuery = useCustomers()

  const data = customersQuery.data ?? []

  return (
    <CustomersProvider>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Customers
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Manage your customers here.
            </p>
          </div>
          <CustomersPrimaryButtons />
        </div>
        {customersQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load customers.
          </div>
        ) : (
          <CustomersTable data={data} search={search} navigate={navigate} />
        )}
      </Main>

      <CustomersDialogs />
    </CustomersProvider>
  )
}
