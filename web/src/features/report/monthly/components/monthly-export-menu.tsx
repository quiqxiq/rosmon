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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type MonthlyExportMenuProps = {
  routerId: number
  year: number
  month: number // 0-11 (JS Date convention).
  from: string // YYYY-MM-DD — first day of the period.
  to: string // YYYY-MM-DD — last day of the period.
  disabled?: boolean
}

// Same slug logic as the daily export menu — mirrored here instead of
// shared because the export-menu pattern is small enough that a single
// helper would need its own file just for two callers. If a third menu
// ever ships, lift to `_shared/`.
function slugifyRouterName(name: string | undefined): string {
  if (!name) return 'router'
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'router'
  )
}

export function MonthlyExportMenu({
  routerId,
  year,
  month,
  from,
  to,
  disabled,
}: MonthlyExportMenuProps) {
  const routersQuery = useRouters()
  const router = routersQuery.data?.find((r) => r.id === routerId)
  const slug = slugifyRouterName(router?.display_name)

  const [pending, setPending] = useState<'csv' | 'excel' | null>(null)
  const isPending = pending != null

  // Filename uses the period stem (e.g. `monthly-routerA-2025-12.csv`)
  // rather than the from/to dates, since the export ALWAYS spans an
  // entire calendar month from this page.
  const periodStem = `${year}-${String(month + 1).padStart(2, '0')}`

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
    runDownload('csv', `monthly-${slug}-${periodStem}.csv`, () =>
      exportSalesCSV(routerId, from, to),
    )

  const handleExcel = () =>
    runDownload('excel', `monthly-${slug}-${periodStem}.xlsx`, () =>
      exportSalesExcel(routerId, from, to),
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
