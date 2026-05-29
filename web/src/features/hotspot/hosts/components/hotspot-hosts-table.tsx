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
import { Link2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useHostsDialogStore } from '../store/hosts-dialog-store'
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
import { type HotspotHostViewModel } from './view-model'
import { columns } from './columns'
import { DataTableRowActions } from './data-table-row-actions'

type HotspotHostsTableProps = {
  data: HotspotHostViewModel[]
}

type HostFilter = 'all' | 'authorized' | 'unauthorized'

const FILTER_TABS: Array<{ value: HostFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'unauthorized', label: 'Unauthorized' },
]

export function HotspotHostsTable({ data }: HotspotHostsTableProps) {
  const openDialog = useHostsDialogStore((s) => s.open)
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [hostFilter, setHostFilter] = useState<HostFilter>('all')

  // Quick-filter tabs gate the dataset before TanStack does its own
  // column filtering. Keeps faceted counts honest for the active scope.
  const filteredData = useMemo(() => {
    if (hostFilter === 'authorized') return data.filter((h) => h.authorized)
    if (hostFilter === 'unauthorized')
      return data.filter((h) => !h.authorized)
    return data
  }, [data, hostFilter])

  // Distinct server facets from the (post-tab) data.
  const serverOptions = useMemo(() => {
    const set = new Set<string>()
    for (const h of filteredData) if (h.server) set.add(h.server)
    return Array.from(set).sort().map((v) => ({ label: v, value: v }))
  }, [filteredData])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
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

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={hostFilter === tab.value ? 'default' : 'outline'}
            size='sm'
            onClick={() => setHostFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search MAC or address...'
        searchKey='macAddress'
        filters={[
          {
            columnId: 'server',
            title: 'Server',
            options: serverOptions,
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
                  No hosts.
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
            const host = row.original
            return (
              <div className='flex min-w-0 items-start gap-2'>
                <span className='min-w-0 flex-1 truncate font-mono text-[12px] font-semibold'>
                  {host.macAddress || '—'}
                </span>
                {host.authorized ? (
                  <Badge variant='online' className='shrink-0 text-[10px]'>
                    auth
                  </Badge>
                ) : (
                  <Badge variant='outline' className='shrink-0 text-[10px]'>
                    —
                  </Badge>
                )}
              </div>
            )
          }}
          renderMeta={(row) => (
            <span className='font-mono'>{row.original.address || '—'}</span>
          )}
          renderDetails={(row): MobileCardDetail[] => {
            const host = row.original
            return [
              {
                label: 'Server',
                value: <span className='font-mono'>{host.server || '—'}</span>,
              },
              {
                label: 'To Address',
                value: <span className='font-mono'>{host.toAddress || '—'}</span>,
              },
              {
                label: 'Comment',
                value: host.comment || (
                  <span className='text-muted-foreground'>—</span>
                ),
              },
            ]
          }}
          renderActions={(row) => <DataTableRowActions row={row} />}
        />
      </div>
      <div className='flex items-center justify-between gap-2'>
        <DataTablePagination table={table} className='flex-1' />
        {selectedCount > 0 && (
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={() => {
                const selected = selectedRows.map((r) => r.original)
                openDialog('bind-many', {
                  ids: selected.map((h) => h.id),
                  bulk: selected,
                })
                table.resetRowSelection()
              }}
            >
              <Link2 className='size-4' />
              Bind ({selectedCount})
            </Button>
            <Button
              variant='destructive'
              size='sm'
              className='gap-1.5'
              onClick={() => {
                const ids = selectedRows.map((r) => r.original.id)
                openDialog('multi-delete', { ids })
                table.resetRowSelection()
              }}
            >
              <Trash2 className='size-4' />
              Remove ({selectedCount})
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
