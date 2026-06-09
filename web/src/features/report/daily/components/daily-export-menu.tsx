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

type DailyExportMenuProps = {
  routerId: number
  date: string // YYYY-MM-DD — already in the same format the backend expects.
  disabled?: boolean
}

// Build a filesystem-safe slug from the router's display name. Used as a
// filename prefix so an admin managing multiple routers doesn't end up
// with N copies of `daily-2025-12-31.csv` colliding in their downloads
// folder.
function slugifyRouterName(name: string | undefined): string {
  if (!name) return 'router'
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'router'
  )
}

export function DailyExportMenu({
  routerId,
  date,
  disabled,
}: DailyExportMenuProps) {
  // Read the router list straight from cache — `useRouters` is shared
  // with the sidebar switcher, so this hook will already be hydrated by
  // the time the user reaches a report page.
  const routersQuery = useRouters()
  const router = routersQuery.data?.find((r) => r.id === routerId)
  const slug = slugifyRouterName(router?.display_name)

  // One in-flight flag covers both CSV and Excel — they share the
  // dropdown trigger, so we just need to disable everything while a
  // download is being prepared. Print stays clickable since it's local.
  const [pending, setPending] = useState<'csv' | 'excel' | null>(null)
  const isPending = pending != null

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
    runDownload('csv', `daily-${slug}-${date}.csv`, () =>
      // Daily export = single-day range. Backend treats `from === to` as
      // inclusive of that one day's sales.
      exportSalesCSV(routerId, date, date),
    )

  const handleExcel = () =>
    runDownload('excel', `daily-${slug}-${date}.xlsx`, () =>
      exportSalesExcel(routerId, date, date),
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
