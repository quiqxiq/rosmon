import { useMemo } from 'react'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useAuditLogs } from './api/queries'
import { columns } from './components/columns'
import { AuditDetailDrawer } from './dialogs/audit-detail-drawer'

export function AuditLogs() {
  const query = useAuditLogs({ limit: 500 })
  const data = query.data ?? []

  const actionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of query.data ?? []) if (l.action) set.add(l.action)
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }))
  }, [query.data])

  const entityOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of query.data ?? []) if (l.entity_type) set.add(l.entity_type)
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
              Audit Logs
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              Who changed what, and when. Newest first.
            </p>
          </div>
        </div>
        {query.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Failed to load audit logs.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            searchKey='entity_type'
            searchPlaceholder='Search entity...'
            filters={[
              { columnId: 'action', title: 'Action', options: actionOptions },
              {
                columnId: 'entity_type',
                title: 'Entity',
                options: entityOptions,
              },
            ]}
            emptyMessage='No audit entries yet.'
            pageSize={20}
          />
        )}
      </Main>
      <AuditDetailDrawer />
    </>
  )
}
