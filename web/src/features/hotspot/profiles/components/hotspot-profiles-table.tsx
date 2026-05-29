import { useState } from 'react'
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
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'
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
import {
  expModeLabels,
  formatIDR,
  monitorOptions,
  expModeOptions,
} from '../data/data'
import { type ExpMode } from '../data/schema'
import { type HotspotProfileViewModel } from './view-model'
import { columns } from './columns'
import { DataTableRowActions } from './data-table-row-actions'

type HotspotProfilesTableProps = {
  data: HotspotProfileViewModel[]
}

// Mirror of the helper in `columns.tsx` so the mobile card matches the
// table's behaviour for unknown exp_mode values from RouterOS.
function labelForExpMode(value: string): string {
  return value in expModeLabels
    ? expModeLabels[value as ExpMode]
    : value || '—'
}

export function HotspotProfilesTable({ data }: HotspotProfilesTableProps) {
  const openDialog = useProfilesDialogStore((s) => s.open)
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

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
        searchPlaceholder='Search profiles...'
        searchKey='name'
        filters={[
          {
            columnId: 'expMode',
            title: 'Exp Mode',
            options: expModeOptions,
          },
          {
            columnId: 'hasExpiredMonitor',
            title: 'Monitor',
            options: monitorOptions,
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
            const profile = row.original
            return (
              <div className='flex min-w-0 items-start gap-2'>
                <span
                  className={cn(
                    'mt-1.5 inline-block size-2 shrink-0 rounded-full',
                    profile.hasExpiredMonitor
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  )}
                />
                <span className='min-w-0 flex-1 truncate font-semibold'>
                  {profile.name}
                </span>
                <Badge
                  variant='outline'
                  className='shrink-0 text-[10px] font-normal'
                >
                  {labelForExpMode(profile.expMode)}
                </Badge>
              </div>
            )
          }}
          renderMeta={(row) => (
            <span className='font-mono'>
              {row.original.rateLimit || '—'} · {row.original.validity || '—'}
            </span>
          )}
          renderDetails={(row): MobileCardDetail[] => {
            const profile = row.original
            return [
              {
                label: 'Price',
                value: (
                  <span className='font-mono tabular-nums'>
                    {formatIDR(profile.price)}
                  </span>
                ),
              },
              {
                label: 'Selling',
                value: (
                  <span className='font-mono tabular-nums text-emerald-600 dark:text-emerald-400'>
                    {formatIDR(profile.sellingPrice)}
                  </span>
                ),
              },
              {
                label: 'Shared',
                value: (
                  <span className='font-mono'>
                    {profile.sharedUsers || '—'}
                  </span>
                ),
              },
              {
                label: 'Lock User',
                value: profile.lockUser ? (
                  <span className='text-emerald-600 dark:text-emerald-400'>
                    ✓
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
