import { useEffect, useState } from 'react'
import {
  type SortingState,
  type VisibilityState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableMobileCards,
  DataTablePagination,
  DataTableToolbar,
  type MobileCardDetail,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { STATUS_TONE } from '../data/data'
import { type Subscription, type SubscriptionStatus } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'
import { DataTableBulkActions } from './data-table-bulk-actions'

type DataTableProps = {
  data: Subscription[]
  columns: ColumnDef<Subscription, unknown>[]
  search: Record<string, unknown>
  navigate: NavigateFn
  customerName: (id: number) => string
}

export function SubscriptionsTable({
  data,
  columns,
  search,
  navigate,
  customerName,
}: DataTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

  // Synced with URL states
  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'mikrotik_username', searchKey: 'mikrotik_username', type: 'string' },
      { columnId: 'service_type', searchKey: 'service_type', type: 'array' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
    ],
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    enableRowSelection: true,
    onPaginationChange,
    onColumnFiltersChange,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search by username...'
        searchKey='mikrotik_username'
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
      />
      <div className='hidden overflow-hidden rounded-md border md:block'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        header.column.columnDef.meta?.className,
                        header.column.columnDef.meta?.thClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='group/row'
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className='md:hidden'>
        <DataTableMobileCards
          table={table}
          renderPrimary={(row) => {
            const sub = row.original
            return (
              <div className='flex min-w-0 items-start gap-2'>
                <span className='min-w-0 flex-1 truncate font-mono font-semibold'>
                  {sub.mikrotik_username}
                </span>
                <Badge
                  variant={STATUS_TONE[sub.status as SubscriptionStatus] ?? 'offline'}
                >
                  {sub.status}
                </Badge>
              </div>
            )
          }}
          renderMeta={(row) => {
            const sub = row.original
            return <span>{customerName(sub.customer_id)}</span>
          }}
          renderDetails={(row): MobileCardDetail[] => {
            const sub = row.original
            return [
              {
                label: 'Service',
                value: <span className='uppercase'>{sub.service_type}</span>,
              },
              {
                label: 'Sync Status',
                value: sub.sync_status || '—',
              },
            ]
          }}
          renderActions={(row) => <DataTableRowActions row={row} />}
        />
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <DataTableBulkActions table={table} />
    </div>
  )
}
