import { useState } from 'react'
import {
  CheckCircle2,
  CloudDownload,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useImportSales } from '@/features/voucher/sales/api/queries'
import type { ImportResult } from '@/features/voucher/sales/api/schema'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSalesDialogStore } from '../store/sales-dialog-store'

// Pull sales records from RouterOS `/system/script` into the DB. The
// endpoint is idempotent (duplicate idempotency_keys are skipped server
// side), so it's safe to re-run — we still confirm before triggering
// because the user usually wants to see the result panel.

type StatRowProps = {
  label: string
  value: number
  tone?: 'default' | 'muted' | 'success' | 'warn' | 'danger'
}

function StatRow({ label, value, tone = 'default' }: StatRowProps) {
  // Tone → colour class. Kept inline because the palette is tiny and
  // each variant only appears once in the result panel below.
  const valueClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'danger'
          ? 'text-destructive'
          : tone === 'muted'
            ? 'text-muted-foreground'
            : ''
  return (
    <div className='flex items-baseline justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <span className={`font-mono text-base font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

export function ImportSalesDialog() {
  const routerId = useActiveRouterId()
  const { kind, close } = useSalesDialogStore()
  const open = kind === 'import'

  // `result` holds the last successful import payload so the dialog
  // swaps from "confirm" → "result" view. Stays in state (not derived
  // from the mutation) because we want the panel to persist after
  // mutation.reset() — closing+reopening should give a fresh confirm
  // step, not a stale result.
  const [result, setResult] = useState<ImportResult | null>(null)
  const mutation = useImportSales(routerId ?? 0)

  // Reset transient state every time the dialog re-opens. Uses the
  // React 19 "derive state during render" pattern (track previous prop
  // via state and compare) to avoid the cascading-render lint warning
  // we'd get from doing this inside useEffect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setResult(null)
  }

  const handleClose = () => {
    if (mutation.isPending) return
    mutation.reset()
    setResult(null)
    close()
  }

  const handleImport = () => {
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }
    mutation.mutate(undefined, {
      onSuccess: (res) => {
        setResult(res)
        if (res.errors > 0) {
          toast.warning('Import finished with errors', {
            description: `${res.imported}/${res.total} imported · ${res.errors} errors`,
          })
        } else {
          toast.success('Import finished', {
            description: `${res.imported}/${res.total} imported`,
          })
        }
      },
      onError: (err) => {
        toast.error('Import failed', { description: err.message })
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose()
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            {result ? (
              <>
                <CheckCircle2 className='size-5 text-emerald-600 dark:text-emerald-400' />
                Import Complete
              </>
            ) : (
              <>
                <CloudDownload className='size-5 text-sky-600 dark:text-sky-400' />
                Import Sales from RouterOS
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {result
              ? 'Sales records have been synced. The page will refresh shortly.'
              : 'Pull sales records written by on-login scripts in `/system/script` into the database. Duplicates are skipped automatically.'}
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className='space-y-2'>
            <StatRow label='Total records' value={result.total} tone='muted' />
            <StatRow label='Imported' value={result.imported} tone='success' />
            <StatRow label='Skipped (duplicates)' value={result.skipped} tone='warn' />
            <StatRow
              label='Errors'
              value={result.errors}
              tone={result.errors > 0 ? 'danger' : 'muted'}
            />
          </div>
        )}

        <DialogFooter className='gap-2'>
          {result ? (
            <Button onClick={handleClose}>Close</Button>
          ) : (
            <>
              <Button
                type='button'
                variant='outline'
                onClick={handleClose}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className='size-3.5 animate-spin' />
                )}
                Import Now
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
