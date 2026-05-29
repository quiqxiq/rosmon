import { useState, type ReactNode } from 'react'
import { type Row, type Table } from '@tanstack/react-table'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export type MobileCardDetail = {
  label: string
  value: ReactNode
}

type DataTableMobileCardsProps<TData> = {
  table: Table<TData>
  renderPrimary: (row: Row<TData>) => ReactNode
  renderMeta?: (row: Row<TData>) => ReactNode
  renderDetails: (row: Row<TData>) => MobileCardDetail[]
  renderActions?: (row: Row<TData>) => ReactNode
  enableSelection?: boolean
  emptyState?: ReactNode
  className?: string
}

export function DataTableMobileCards<TData>({
  table,
  renderPrimary,
  renderMeta,
  renderDetails,
  renderActions,
  enableSelection = true,
  emptyState,
  className,
}: DataTableMobileCardsProps<TData>) {
  const rows = table.getRowModel().rows

  if (!rows.length) {
    return (
      <div
        className={cn(
          'rounded-md border bg-card p-6 text-center text-sm text-muted-foreground',
          className
        )}
      >
        {emptyState ?? 'No results.'}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {rows.map((row) => (
        <MobileCard
          key={row.id}
          row={row}
          renderPrimary={renderPrimary}
          renderMeta={renderMeta}
          renderDetails={renderDetails}
          renderActions={renderActions}
          enableSelection={enableSelection}
        />
      ))}
    </div>
  )
}

type MobileCardProps<TData> = {
  row: Row<TData>
  renderPrimary: (row: Row<TData>) => ReactNode
  renderMeta?: (row: Row<TData>) => ReactNode
  renderDetails: (row: Row<TData>) => MobileCardDetail[]
  renderActions?: (row: Row<TData>) => ReactNode
  enableSelection: boolean
}

function MobileCard<TData>({
  row,
  renderPrimary,
  renderMeta,
  renderDetails,
  renderActions,
  enableSelection,
}: MobileCardProps<TData>) {
  const [open, setOpen] = useState(false)
  const details = renderDetails(row)
  const meta = renderMeta?.(row)
  const actions = renderActions?.(row)
  const selected = row.getIsSelected()
  const canSelect = enableSelection && row.getCanSelect()

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <article
        data-state={selected ? 'selected' : undefined}
        className={cn(
          'rounded-md border bg-card text-card-foreground shadow-xs transition-colors',
          selected && 'border-primary/40 bg-primary/5'
        )}
      >
        <div className='flex min-w-0 items-start gap-2 p-3'>
          {canSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label='Select row'
              className='mt-1'
            />
          )}
          <CollapsibleTrigger
            className='flex min-w-0 flex-1 items-start gap-2 text-start outline-none'
            aria-label={open ? 'Collapse details' : 'Expand details'}
          >
            <div className='flex min-w-0 flex-1 flex-col gap-1'>
              <div className='min-w-0 text-sm font-medium'>
                {renderPrimary(row)}
              </div>
              {meta ? (
                <div className='min-w-0 text-xs text-muted-foreground'>
                  {meta}
                </div>
              ) : null}
            </div>
            <ChevronDown
              className={cn(
                'mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180'
              )}
            />
          </CollapsibleTrigger>
          {actions ? (
            <div
              className='ms-1 flex shrink-0 items-center'
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          ) : null}
        </div>
        <CollapsibleContent className='CollapsibleContent'>
          <div className='border-t px-3 py-2'>
            <dl className='grid grid-cols-1 gap-x-3 gap-y-2 text-xs'>
              {details.map((detail, index) => (
                <div
                  key={`${detail.label}-${index}`}
                  className='flex items-start justify-between gap-3'
                >
                  <dt className='shrink-0 text-muted-foreground'>
                    {detail.label}
                  </dt>
                  <dd className='min-w-0 text-end text-foreground'>
                    {detail.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}
