import { Loader2, Plus, RefreshCw, ServerOff } from 'lucide-react'
import { toast } from 'sonner'
import { useQuickPrintPackages } from '@/features/voucher/print/api/queries'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { QuickPrintCard } from './components/quick-print-card'
import { PresetDialogs } from './dialogs/preset-dialogs'
import { useApiPresetsWithMeta } from './lib/preset-mapping'
import { usePresetsDialogStore } from './store/presets-dialog-store'

export function VoucherPrint() {
  const routerId = useActiveRouterId()
  const {
    data: apiPackages,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuickPrintPackages(routerId ?? 0)
  const presets = useApiPresetsWithMeta(apiPackages)
  const openDialog = usePresetsDialogStore((s) => s.open)

  // No-router-selected — quick-print is router-scoped on the backend.
  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to manage its quick-print
          presets.
        </p>
      </Main>
    )
  }

  const totalCount = presets.length

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Quick Print
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            {isLoading
              ? 'Loading…'
              : `${totalCount} preset configuration${totalCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              refetch()
              toast.info('Refreshing presets…')
            }}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <RefreshCw className='size-4' />
            )}
            Refresh
          </Button>
          <Button
            size='sm'
            className='gap-1.5'
            onClick={() => openDialog('add')}
          >
            <Plus className='size-4' />
            Add Preset
          </Button>
        </div>
      </div>

      {isError && (
        <div className='rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'>
          Failed to load presets. Click Refresh to try again.
        </div>
      )}

      {!isError && !isLoading && presets.length === 0 && (
        <div className='rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground'>
          No quick-print presets yet. Click <strong>Add Preset</strong> to
          create one.
        </div>
      )}

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {presets.map((preset) => (
          <QuickPrintCard key={preset.id} preset={preset} />
        ))}
      </div>
      <PresetDialogs />
    </Main>
  )
}
