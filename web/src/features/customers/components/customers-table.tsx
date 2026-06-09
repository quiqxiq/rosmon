import { useEffect, useState, useMemo } from 'react'
import {
  type SortingState,
  type VisibilityState,
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
import { callTypes } from '../data/data'
import { type Customer } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'
import { customersColumns as columns } from './customers-columns'
import { DataTableBulkActions } from './data-table-bulk-actions'

type DataTableProps = {
  data: Customer[]
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function CustomersTable({ data, search, navigate }: DataTableProps) {
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
      { columnId: 'full_name', searchKey: 'full_name', type: 'string' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'area', searchKey: 'area', type: 'array' },
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

  const areaOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of data) {
      if (c.area) set.add(c.area)
    }
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }))
  }, [data])

  return (
    <div
      className={cn(
        'max-sm:has-[div[role="toolbar"]]:mb-16',
        'flex flex-1 flex-col gap-4'
      )}
    >
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search customers...'
        searchKey='full_name'
        filters={[
          {
            columnId: 'status',
            title: 'Status',
            options: [
              { label: 'Aktif', value: 'aktif' },
              { label: 'Nonaktif', value: 'nonaktif' },
            ],
          },
          {
            columnId: 'area',
            title: 'Area',
            options: areaOptions,
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
            const customer = row.original
            const badgeColor = callTypes.get(customer.status as any)
            return (
              <div className='flex min-w-0 items-start gap-2'>
                <span className='min-w-0 flex-1 truncate'>{customer.full_name}</span>
                <Badge
                  variant='outline'
                  className={cn(
                    'shrink-0 text-[10px] capitalize',
                    badgeColor
                  )}
                >
                  {customer.status}
                </Badge>
              </div>
            )
          }}
          renderMeta={(row) => {
            const customer = row.original
            return <span>{customer.phone || '—'}</span>
          }}
          renderDetails={(row): MobileCardDetail[] => {
            const customer = row.original
            return [
              {
                label: 'Area',
                value: customer.area || '—',
              },
              {
                label: 'Address',
                value: customer.address || '—',
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
