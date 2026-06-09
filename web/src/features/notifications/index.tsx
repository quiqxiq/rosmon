import { useMemo } from 'react'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useNotifications } from './api/queries'
import { columns } from './components/columns'
import { NotificationDetailDrawer } from './dialogs/notification-detail-drawer'

export function Notifications() {
  const query = useNotifications({ limit: 500 })
  const data = query.data ?? []

  const templateOptions = useMemo(() => {
    const set = new Set<string>()
    for (const n of query.data ?? []) if (n.template_slug) set.add(n.template_slug)
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }))
  }, [query.data])

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Notification Log
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Every WhatsApp message the system sent, with delivery + retry
              status.
            </p>
          </div>
        </div>
        {query.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load notifications.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            searchKey='recipient_phone'
            searchPlaceholder='Search recipient...'
            filters={[
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Sent', value: 'sent' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Failed', value: 'failed' },
                ],
              },
              {
                columnId: 'template_slug',
                title: 'Template',
                options: templateOptions,
              },
            ]}
            emptyMessage='No notifications sent yet.'
            pageSize={20}
          />
        )}
      </Main>
      <NotificationDetailDrawer />
    </>
  )
}
