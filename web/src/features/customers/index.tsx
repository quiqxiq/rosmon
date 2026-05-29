import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useCustomers } from './api/queries'
import { columns } from './components/columns'
import { CustomerMutateDrawer } from './dialogs/customer-mutate-drawer'
import { useCustomersDialogStore } from './store/customers-dialog-store'

export function Customers() {
  const customersQuery = useCustomers()
  const openDialog = useCustomersDialogStore((s) => s.open)

  const data = customersQuery.data ?? []
  const areaOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of customersQuery.data ?? []) if (c.area) set.add(c.area)
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }))
  }, [customersQuery.data])

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Customers
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {data.length} customer{data.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button size='sm' className='gap-1.5' onClick={() => openDialog('add')}>
            <Plus className='size-4' />
            Add Customer
          </Button>
        </div>
        {customersQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load customers.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            searchKey='full_name'
            searchPlaceholder='Search customers...'
            filters={[
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Aktif', value: 'aktif' },
                  { label: 'Nonaktif', value: 'nonaktif' },
                ],
              },
              { columnId: 'area', title: 'Area', options: areaOptions },
            ]}
            emptyMessage='No customers yet.'
          />
        )}
      </Main>
      <CustomerMutateDrawer />
    </>
  )
}
