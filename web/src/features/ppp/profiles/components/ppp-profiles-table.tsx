import { useState } from 'react'
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
import { type RouterPPPProfile } from '../api/schema'
import { columns } from './columns'
import { DataTableRowActions } from './data-table-row-actions'

type PPPProfilesTableProps = {
  data: RouterPPPProfile[]
}

const STATUS_OPTIONS = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

export function PPPProfilesTable({ data }: PPPProfilesTableProps) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    // Status is shown as a coloured dot on the Name cell; the column itself
    // stays hidden and only powers the "Status" faceted filter.
    status: false,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
    onPaginationChange: setPagination,
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
        searchPlaceholder='Search profiles...'
        searchKey='name'
        filters={[
          { columnId: 'status', title: 'Status', options: STATUS_OPTIONS },
        ]}
      />
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
                      'bg-background group-hover/row:bg-muted',
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
                <TableRow key={row.id} className='group/row'>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'bg-background group-hover/row:bg-muted',
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
                  No profiles.
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
            const p = row.original
            const enabled = !p.disabled
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
                  {p.name}
                </span>
              </div>
            )
          }}
          renderMeta={(row) => (
            <span className='font-mono'>{row.original.rate_limit || '—'}</span>
          )}
          renderDetails={(row): MobileCardDetail[] => {
            const p = row.original
            return [
              {
                label: 'Local',
                value: (
                  <span className='font-mono text-[11px]'>
                    {p.local_address || '—'}
                  </span>
                ),
              },
              {
                label: 'Remote',
                value: (
                  <span className='font-mono text-[11px]'>
                    {p.remote_address || '—'}
                  </span>
                ),
              },
              {
                label: 'Parent Queue',
                value: (
                  <span className='font-mono text-[11px]'>
                    {p.parent_queue || '—'}
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
