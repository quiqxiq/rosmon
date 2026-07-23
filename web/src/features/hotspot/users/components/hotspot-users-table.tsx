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
import { Printer, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUsersDialogStore } from '../store/users-dialog-store'
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
import { formatBytes } from '../../_shared/format'
import { type HotspotUserViewModel } from './view-model'
import { columns } from './columns'
import { DataTableRowActions } from './data-table-row-actions'

type HotspotUsersTableProps = {
  data: HotspotUserViewModel[]
  onPrint?: (users: HotspotUserViewModel[], template: string) => void
}

// Static filter facet for the enabled-status column. Profile and server
// facets are derived from the actual data so they reflect what's on the
// router instead of a stale hardcoded list.
const ENABLED_OPTIONS = [
  { label: 'Enabled', value: 'enabled' },
  { label: 'Disabled', value: 'disabled' },
]

import { DataTableBulkActions } from '@/components/data-table'

export function HotspotUsersTable({ data, onPrint }: HotspotUsersTableProps) {
  const openDialog = useUsersDialogStore((s) => s.open)
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    // Status is shown as a coloured dot on the Username cell; the column
    // itself stays hidden and only powers the "Status" faceted filter.
    enabledStatus: false,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  // Derive distinct profile/server options from the data we're rendering
  // so filters never get stuck on values that no longer exist.
  const profileOptions = useMemo(() => {
    const set = new Set<string>()
    for (const u of data) if (u.profile) set.add(u.profile)
    return Array.from(set)
      .sort()
      .map((v) => ({ label: v, value: v }))
  }, [data])
  const serverOptions = useMemo(() => {
    const set = new Set<string>()
    for (const u of data) if (u.server) set.add(u.server)
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

  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search users...'
        searchKey='name'
        filters={[
          {
            columnId: 'enabledStatus',
            title: 'Status',
            options: ENABLED_OPTIONS,
          },
          {
            columnId: 'profile',
            title: 'Profile',
            options: profileOptions,
          },
          {
            columnId: 'server',
            title: 'Server',
            options: serverOptions,
          },
        ]}
      />
      <DataTableBulkActions table={table} entityName='user'>
        <Button
          variant='destructive'
          size='sm'
          className='gap-1.5'
          onClick={() => {
            const ids = table
              .getFilteredSelectedRowModel()
              .rows.map((r) => r.original.id)
            openDialog('multi-delete', { ids })
            table.resetRowSelection()
          }}
        >
          <Trash2 className='size-4' />
          Remove ({selectedCount})
        </Button>
      </DataTableBulkActions>
      <div className='flex items-center gap-2'>
        <Input
          placeholder='Filter by comment (e.g. G170...)'
          value={(table.getColumn('comment')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('comment')?.setFilterValue(event.target.value)}
          className='h-8 w-64'
        />
        {onPrint && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm' className='gap-1.5 ml-auto'>
                <Printer className='size-4' />
                Print ({table.getFilteredRowModel().rows.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() =>
                  onPrint(
                    table.getFilteredRowModel().rows.map((r) => r.original),
                    'default',
                  )
                }
              >
                Default Template
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onPrint(
                    table.getFilteredRowModel().rows.map((r) => r.original),
                    'thermal',
                  )
                }
              >
                Thermal Template
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onPrint(
                    table.getFilteredRowModel().rows.map((r) => r.original),
                    'small',
                  )
                }
              >
                Small Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
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
            const user = row.original
            const enabled = user.enabledStatus === 'enabled'
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
                  {user.name}
                </span>
              </div>
            )
          }}
          renderMeta={(row) => (
            <span className='font-mono'>{row.original.profile || '—'}</span>
          )}
          renderDetails={(row): MobileCardDetail[] => {
            const user = row.original
            const hasTraffic = user.bytesIn + user.bytesOut > 0
            return [
              {
                label: 'MAC',
                value: (
                  <span className='font-mono text-[11px]'>
                    {user.macAddress || '—'}
                  </span>
                ),
              },
              {
                label: 'Server',
                value: <span className='font-mono'>{user.server || '—'}</span>,
              },
              {
                label: 'Uptime',
                value: (
                  <span
                    className={cn(
                      'font-mono',
                      !user.uptime && 'text-muted-foreground'
                    )}
                  >
                    {user.uptime || '—'}
                  </span>
                ),
              },
              {
                label: 'Expiry',
                value: user.expiry ? (
                  <div className='flex items-center gap-1.5'>
                    <span className='font-mono text-[11px]'>
                      {user.expiry.at.toLocaleDateString()}
                    </span>
                    {user.expiry.isPast && (
                      <Badge variant='expired' className='text-[10px]'>
                        Expired
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className='text-muted-foreground'>—</span>
                ),
              },
              {
                label: 'Traffic',
                value: hasTraffic ? (
                  <span className='font-mono text-[11px]'>
                    <span className='text-sky-600 dark:text-sky-400'>
                      ↓{formatBytes(user.bytesIn)}
                    </span>
                    {' '}
                    <span className='text-violet-600 dark:text-violet-400'>
                      ↑{formatBytes(user.bytesOut)}
                    </span>
                  </span>
                ) : (
                  <span className='text-muted-foreground'>—</span>
                ),
              },
            ]
          }}
          renderActions={(row) => <DataTableRowActions row={row} />}
        />
      </div>
      <div className='flex items-center justify-between'>
        <DataTablePagination table={table} className='flex-1' />
        {selectedCount > 0 && (
          <Button
            variant='destructive'
            size='sm'
            className='gap-1.5'
            onClick={() => {
              const ids = table
                .getFilteredSelectedRowModel()
                .rows.map((r) => r.original.id)
              openDialog('multi-delete', { ids })
              table.resetRowSelection()
            }}
          >
            <Trash2 className='size-4' />
            Remove ({selectedCount})
          </Button>
        )}
      </div>
    </div>
  )
}
