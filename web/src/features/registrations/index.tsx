import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useRegistrations } from './api/queries'
import { columns } from './components/columns'
import { CompleteInstallDrawer } from './dialogs/complete-install-drawer'
import { RegistrationActionDialogs } from './dialogs/registration-action-dialogs'

export function Registrations() {
  const query = useRegistrations()
  const data = query.data ?? []
  const pending = data.filter((r) => r.status === 'pending').length

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Registrations
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Installation requests from the public form. {pending} pending
              review.
            </p>
          </div>
        </div>
        {query.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load registrations.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            searchKey='full_name'
            searchPlaceholder='Search by name...'
            filters={[
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Pending', value: 'pending' },
                  { label: 'Approved', value: 'approved' },
                  { label: 'Rejected', value: 'rejected' },
                  { label: 'Cancelled', value: 'cancelled' },
                ],
              },
            ]}
            emptyMessage='No registrations yet.'
            pageSize={20}
          />
        )}
      </Main>
      <RegistrationActionDialogs />
      <CompleteInstallDrawer />
    </>
  )
}
