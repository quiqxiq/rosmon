import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

type SalesPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  disabled?: boolean
}

export function SalesPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  disabled,
}: SalesPaginationProps) {
  // `pageCount` is the upper bound on `page`. Clamp at 1 so an empty
  // result set still renders "Page 1 of 1" instead of "Page 1 of 0".
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = page > 1 && !disabled
  const canNext = page < pageCount && !disabled

  // Showing window e.g. "Showing 26-50 of 137". Mostly for context when
  // the user is deep into the data and the Prev/Next are the only
  // navigation. The end index clamps at `total` for the last partial
  // page.
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, total)

  return (
    <div className='flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground'>
      <div className='flex items-center gap-2'>
        <span>
          {total === 0
            ? 'No records'
            : `Showing ${startRow}–${endRow} of ${total}`}
        </span>
        <span aria-hidden className='hidden sm:inline'>
          ·
        </span>
        <div className='hidden items-center gap-1.5 sm:flex'>
          <span>Per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
            disabled={disabled}
          >
            <SelectTrigger className='h-7 w-[68px] text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <span>
          Page <span className='tabular-nums'>{page}</span> of{' '}
          <span className='tabular-nums'>{pageCount}</span>
        </span>
        <div className='flex gap-1'>
          <Button
            variant='outline'
            size='icon'
            className='size-7'
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
            aria-label='Previous page'
          >
            <ChevronLeft className='size-3.5' />
          </Button>
          <Button
            variant='outline'
            size='icon'
            className='size-7'
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
            aria-label='Next page'
          >
            <ChevronRight className='size-3.5' />
          </Button>
        </div>
      </div>
    </div>
  )
}

export { PAGE_SIZE_OPTIONS }
