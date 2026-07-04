import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { Loader2, RefreshCw, ServerOff, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useCustomers } from '@/features/customers/api/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table'
import { useSubscriptionsByDevice } from './api/queries'
import { makeMonitoringColumns } from './components/subscriptions-monitoring-columns'
import { SubscriptionsProvider } from './components/subscriptions-provider'
import { SubscriptionsDialogs } from './components/subscriptions-dialogs'
import { cn } from '@/lib/utils'

function MonitoringTable() {
  const routerId = useActiveRouterId()
  const query = useSubscriptionsByDevice(routerId ?? 0)
  const customersQuery = useCustomers()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const customerName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of customersQuery.data ?? []) map.set(c.id, c.full_name)
    return (id: number) => map.get(id) ?? `#${id}`
  }, [customersQuery.data])

  const columns = useMemo(
    () => makeMonitoringColumns(customerName),
    [customerName],
  )

  const data = query.data ?? []
  const onlineCount = data.filter((d) => d.session !== null).length
  const offlineCount = data.length - onlineCount
  const driftCount = data.filter((d) => d.router_drift !== '').length

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  function handleRefresh() {
    query.refetch()
    toast.info('Memuat ulang data monitoring…')
  }

  if (routerId == null) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>Tidak ada router dipilih</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Pilih router dari sidebar untuk melihat monitoring subscription.
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-1 flex-col gap-4'>
      {/* Toolbar */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline' className='gap-1.5 text-xs'>
            <span className='size-2 rounded-full bg-emerald-500' />
            {onlineCount} online
          </Badge>
          <Badge variant='outline' className='gap-1.5 text-xs'>
            <span className='size-2 rounded-full bg-muted-foreground/40' />
            {offlineCount} offline
          </Badge>
          {driftCount > 0 && (
            <Badge variant='destructive' className='text-xs'>
              ⚠ {driftCount} drift
            </Badge>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {/* Filter status */}
          <select
            className='h-8 rounded-md border bg-background px-2 text-xs'
            onChange={(e) => {
              const val = e.target.value
              if (val) {
                setColumnFilters((prev) => [
                  ...prev.filter((f) => f.id !== 'status'),
                  { id: 'status', value: [val] },
                ])
              } else {
                setColumnFilters((prev) => prev.filter((f) => f.id !== 'status'))
              }
            }}
          >
            <option value=''>Semua status</option>
            <option value='active'>Active</option>
            <option value='isolir'>Isolir</option>
            <option value='suspended'>Suspended</option>
            <option value='terminated'>Terminated</option>
            <option value='pending_install'>Pending Install</option>
          </select>
          {/* Filter service type */}
          <select
            className='h-8 rounded-md border bg-background px-2 text-xs'
            onChange={(e) => {
              const val = e.target.value
              if (val) {
                setColumnFilters((prev) => [
                  ...prev.filter((f) => f.id !== 'service_type'),
                  { id: 'service_type', value: [val] },
                ])
              } else {
                setColumnFilters((prev) =>
                  prev.filter((f) => f.id !== 'service_type'),
                )
              }
            }}
          >
            <option value=''>Semua service</option>
            <option value='pppoe'>PPPoE</option>
            <option value='hotspot'>Hotspot</option>
          </select>
          <Button
            variant='outline'
            size='sm'
            onClick={handleRefresh}
            disabled={query.isFetching}
            className='gap-1.5'
          >
            {query.isFetching ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <RefreshCw className='size-4' />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {query.isError ? (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
          Gagal memuat data monitoring. Klik Refresh untuk coba lagi.
        </div>
      ) : (
        <>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        className={cn(
                          'bg-background',
                          (h.column.columnDef.meta as { className?: string })?.className,
                        )}
                      >
                        {h.isPlaceholder
                          ? null
                          : flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            (cell.column.columnDef.meta as { className?: string })
                              ?.className
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='h-24 text-center text-sm text-muted-foreground'
                    >
                      {query.isLoading ? 'Memuat data…' : 'Tidak ada subscription untuk router ini.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} className='mt-auto' />
        </>
      )}
    </div>
  )
}

export function SubscriptionsMonitoring() {
  const routerId = useActiveRouterId()
  const query = useSubscriptionsByDevice(routerId ?? 0)

  const data = query.data ?? []
  const onlineCount = data.filter((d) => d.session !== null).length

  return (
    <SubscriptionsProvider>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
              Monitoring Subscription
            </h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {data.length} subscription
              {onlineCount > 0 && (
                <span className='ml-2 inline-flex items-center gap-1 text-emerald-600'>
                  <Wifi className='size-3.5' />
                  {onlineCount} online
                </span>
              )}
              {data.length - onlineCount > 0 && (
                <span className='ml-2 inline-flex items-center gap-1 text-muted-foreground'>
                  <WifiOff className='size-3.5' />
                  {data.length - onlineCount} offline
                </span>
              )}
              <span className='ml-2 text-xs text-muted-foreground'>(auto-refresh 30s)</span>
            </p>
          </div>
        </div>

        <MonitoringTable />
      </Main>
      <SubscriptionsDialogs />
    </SubscriptionsProvider>
  )
}
