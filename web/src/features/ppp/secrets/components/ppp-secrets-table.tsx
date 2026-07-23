import { useMemo, useState } from 'react'
import {
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  type PaginationState,
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
import { type PPPSecret } from '../api/schema'
import { columns } from './columns'
import { DataTableRowActions } from './data-table-row-actions'

import { DataTableBulkActions } from './data-table-bulk-actions'

type PPPSecretsTableProps = {
  data: PPPSecret[]
}

const STATUS_OPTIONS = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

export function PPPSecretsTable({ data }: PPPSecretsTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    // Status is shown as a coloured dot on the Username cell; the column
    // itself stays hidden and only powers the "Status" faceted filter.
    status: false,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const profileOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of data) if (s.profile) set.add(s.profile)
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }))
  }, [data])

  // eslint-disable-next-line react-hooks/incompatible-library
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
    onPaginationChange: setPagination,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search secrets...'
        searchKey='name'
        filters={[
          { columnId: 'status', title: 'Status', options: STATUS_OPTIONS },
          { columnId: 'profile', title: 'Profile', options: profileOptions },
        ]}
      />
      <DataTableBulkActions table={table} />
      <div className='hidden overflow-hidden rounded-md border md:block'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className='group/row'>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                      header.column.columnDef.meta?.className
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
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
                        cell.column.columnDef.meta?.className
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
                <TableCell colSpan={columns.length} className='h-24 text-center'>
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
            const s = row.original
            const enabled = !s.disabled
            return (
              <div className='flex min-w-0 items-center gap-2'>
                <span
                  className={cn(
                    'inline-block size-2 shrink-0 rounded-full',
                    enabled ? 'bg-emerald-500' : 'bg-red-500'
                  )}
                  title={enabled ? 'Enabled' : 'Disabled'}
                />
                <span className='min-w-0 flex-1 truncate font-semibold'>
                  {s.name}
                </span>
              </div>
            )
          }}
          renderMeta={(row) => (
            <span className='font-mono'>{row.original.profile || '—'}</span>
          )}
          renderDetails={(row): MobileCardDetail[] => {
            const s = row.original
            return [
              {
                label: 'Service',
                value: <span className='font-mono'>{s.service || 'any'}</span>,
              },
              {
                label: 'Remote',
                value: (
                  <span className='font-mono text-[11px]'>
                    {s.remote_address || '—'}
                  </span>
                ),
              },
              {
                label: 'Last Caller',
                value: (
                  <span className='font-mono text-[11px]'>
                    {s.last_caller_id || '—'}
                  </span>
                ),
              },
            ]
          }}
          renderActions={(row) => <DataTableRowActions row={row} />}
        />
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
