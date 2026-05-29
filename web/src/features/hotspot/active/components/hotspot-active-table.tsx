import { useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
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
import { Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useActiveDialogStore } from '../store/active-dialog-store'
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
import { type HotspotActiveViewModel } from './view-model'
import { columns } from './columns'
import { DataTableRowActions } from './data-table-row-actions'

type HotspotActiveTableProps = {
  data: HotspotActiveViewModel[]
}

export function HotspotActiveTable({ data }: HotspotActiveTableProps) {
  const openDialog = useActiveDialogStore((s) => s.open)
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  // Distinct server/loginBy facets derived from rendered data so filters
  // never include stale options when sessions churn.
  const serverOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of data) if (s.server) set.add(s.server)
    return Array.from(set).sort().map((v) => ({ label: v, value: v }))
  }, [data])
  const loginByOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of data) if (s.loginBy) set.add(s.loginBy)
    return Array.from(set).sort().map((v) => ({ label: v, value: v }))
  }, [data])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: { pageIndex: 0, pageSize: 10 },
      rowSelection,
      columnFilters,
      columnVisibility,
    },
    onPaginationChange: () => {},
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
        searchPlaceholder='Search user or address...'
        searchKey='user'
        filters={[
          {
            columnId: 'server',
            title: 'Server',
            options: serverOptions,
          },
          {
            columnId: 'loginBy',
            title: 'Login By',
            options: loginByOptions,
          },
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
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No active sessions.
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
            const session = row.original
            return (
              <div className='flex min-w-0 items-start gap-2'>
                <span className='min-w-0 flex-1 truncate font-semibold'>
                  {session.user || '—'}
                </span>
                <Badge
                  variant='outline'
                  className='shrink-0 text-[10px] font-mono'
                >
                  {session.server || '—'}
                </Badge>
              </div>
            )
          }}
          renderMeta={(row) => (
            <span className='font-mono'>{row.original.address || '—'}</span>
          )}
          renderDetails={(row): MobileCardDetail[] => {
            const s = row.original
            return [
              {
                label: 'MAC',
                value: (
                  <span className='font-mono text-[11px]'>
                    {s.macAddress || '—'}
                  </span>
                ),
              },
              {
                label: 'Uptime',
                value: <span className='font-mono'>{s.uptime || '—'}</span>,
              },
              {
                label: 'Time Left',
                value: (
                  <span className='font-mono'>{s.sessionTimeLeft || '—'}</span>
                ),
              },
              {
                label: 'Login By',
                value: <span className='font-mono'>{s.loginBy || '—'}</span>,
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
              openDialog('disconnect-many', { ids })
              table.resetRowSelection()
            }}
          >
            <Power className='size-4' />
            Disconnect ({selectedCount})
          </Button>
        )}
      </div>
    </div>
  )
}
