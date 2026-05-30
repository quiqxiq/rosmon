import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useMessageTemplates } from './api/queries'
import { columns } from './components/columns'
import { TemplateEditDrawer } from './dialogs/template-edit-drawer'

export function MessageTemplates() {
  const query = useMessageTemplates()
  const data = query.data ?? []

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Message Templates
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              WhatsApp notification templates. Edit the wording; the slug is
              fixed.
            </p>
          </div>
        </div>
        {query.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load templates.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            searchKey='name'
            searchPlaceholder='Search templates...'
            filters={[
              {
                columnId: 'active',
                title: 'Status',
                options: [
                  { label: 'Active', value: 'true' },
                  { label: 'Inactive', value: 'false' },
                ],
              },
            ]}
            emptyMessage='No templates seeded.'
            pageSize={20}
          />
        )}
      </Main>
      <TemplateEditDrawer />
    </>
  )
}
