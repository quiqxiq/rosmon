import { useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouters } from '@/features/routers/api/queries'
import { downloadBlob } from '@/features/voucher/sales/api/download'
import {
  exportSalesCSV,
  exportSalesExcel,
} from '@/features/voucher/sales/api/service'
import type { SaleFilters } from '@/features/voucher/sales/api/schema'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mirrors daily/monthly export menus but accepts an explicit `from`/`to`
// range plus the active filters. Hits the existing
// `exportSalesCSV`/`exportSalesExcel` blob endpoints — those already
// support range queries, so no backend work is needed.

type SalesExportMenuProps = {
  routerId: number
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  filters?: SaleFilters
  disabled?: boolean
}

function slugifyRouterName(name: string | undefined): string {
  if (!name) return 'router'
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'router'
  )
}

export function SalesExportMenu({
  routerId,
  from,
  to,
  filters,
  disabled,
}: SalesExportMenuProps) {
  const routersQuery = useRouters()
  const router = routersQuery.data?.find((r) => r.id === routerId)
  const slug = slugifyRouterName(router?.name)

  const [pending, setPending] = useState<'csv' | 'excel' | null>(null)
  const isPending = pending != null

  // Filename includes range + filter signature when active so multiple
  // exports don't clobber each other in the user's download folder.
  const filterStem = filters
    ? [filters.profile, filters.server, filters.search]
        .filter(Boolean)
        .join('-')
    : ''
  const rangeStem = from === to ? from : `${from}_${to}`
  const baseStem = filterStem
    ? `sales-${slug}-${rangeStem}-${filterStem}`
    : `sales-${slug}-${rangeStem}`

  const runDownload = async (
    kind: 'csv' | 'excel',
    filename: string,
    fetcher: () => Promise<Blob>,
  ) => {
    setPending(kind)
    try {
      const blob = await fetcher()
      downloadBlob(blob, filename)
      toast.success(`${kind.toUpperCase()} downloaded`, {
        description: filename,
      })
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : `Failed to export ${kind}`
      toast.error('Export failed', { description: msg })
    } finally {
      setPending(null)
    }
  }

  const handleCsv = () =>
    runDownload('csv', `${baseStem}.csv`, () =>
      exportSalesCSV(routerId, from, to, filters),
    )

  const handleExcel = () =>
    runDownload('excel', `${baseStem}.xlsx`, () =>
      exportSalesExcel(routerId, from, to, filters),
    )

  const handlePrint = () => {
    window.print()
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-8 gap-1.5'
          disabled={disabled || isPending}
        >
          {isPending ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : (
            <Download className='size-3.5' />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        <DropdownMenuItem onClick={handleCsv} disabled={isPending}>
          <FileText className='size-4' />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcel} disabled={isPending}>
          <FileSpreadsheet className='size-4' />
          Export Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className='size-4' />
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
