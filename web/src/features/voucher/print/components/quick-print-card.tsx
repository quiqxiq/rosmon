import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Loader2, Pencil, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useGenerateVoucher } from '@/features/voucher/generate/api/queries'
import { type GeneratedVoucher } from '@/features/voucher/generate/data/schema'
import { usePrintStore } from '@/features/voucher/print-render/store/print-store'
import { usePresetsDialogStore } from '@/features/voucher/print/store/presets-dialog-store'
import { useActiveRouterId } from '@/stores/active-router-store'
import { cn } from '@/lib/utils'
import { formatIDR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { colorClassMap, formatDataLimit } from '../data/data'
import { type QuickPrintPreset } from '../data/schema'

type QuickPrintCardProps = {
  preset: QuickPrintPreset
}

// Sample size for the "tap card to print" flow. Real users typically
// generate larger batches via the Generate page; this is just a quick
// preview.
const SAMPLE_QTY = 5

// Convert preset's UI data-limit (number + unit) back to the bytes int
// the backend's voucher-generate endpoint expects.
function dataLimitBytes(preset: QuickPrintPreset): number {
  if (preset.dataLimit <= 0) return 0
  return preset.dataLimitUnit === 'GB'
    ? preset.dataLimit * 1_073_741_824
    : preset.dataLimit * 1_048_576
}

export function QuickPrintCard({ preset }: QuickPrintCardProps) {
  const colorCls = colorClassMap[preset.color]
  const routerId = useActiveRouterId()
  const openPrint = usePrintStore((s) => s.open)
  const openDialog = usePresetsDialogStore((s) => s.open)
  const generateMutation = useGenerateVoucher(routerId ?? 0)

  const handleOpen = () => {
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }
    // Generate vouchers on the real router using the preset's config,
    // then hand them off to the print preview dialog. Replaces the old
    // mock `generateBatch` so the printed cards match what was actually
    // created on RouterOS.
    generateMutation.mutate(
      {
        qty: SAMPLE_QTY,
        server: preset.server === 'all' ? undefined : preset.server,
        user_type: preset.userMode,
        name_length: preset.userLength,
        prefix: preset.prefix || undefined,
        char_set: preset.charSet,
        profile: preset.profile,
        time_limit: preset.timeLimit || undefined,
        data_limit: dataLimitBytes(preset),
        comment: preset.name,
      },
      {
        onSuccess: (data) => {
          const vouchers: GeneratedVoucher[] = data.vouchers.map((v, i) => ({
            id: `${data.gencode}-${i + 1}`,
            username: v.username,
            password: v.password,
            profile: data.profile,
            comment: preset.name,
          }))
          openPrint({
            template: 'default',
            vouchers,
            meta: {
              title: preset.package,
              profile: preset.profile,
              server: preset.server,
              validity: preset.validity,
              sellingPrice: preset.sellingPrice,
            },
          })
        },
        onError: (err) => {
          toast.error('Failed to generate batch', {
            description: err.message,
          })
        },
      },
    )
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    openDialog('edit', { target: preset })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    openDialog('delete', { target: preset })
  }

  return (
    <button
      type='button'
      onClick={handleOpen}
      disabled={generateMutation.isPending}
      className={cn(
        'group relative flex w-full flex-col gap-3 rounded-md border border-l-4 bg-card p-4 text-left transition-all hover:shadow-md',
        'disabled:cursor-wait disabled:opacity-70',
        colorCls.border
      )}
    >
      <div className='flex items-start gap-3'>
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            colorCls.bg,
            colorCls.text
          )}
        >
          {generateMutation.isPending ? (
            <Loader2 className='size-5 animate-spin' />
          ) : (
            <Printer className='size-5' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <h3 className='truncate text-base font-semibold'>
              {preset.package}
            </h3>
            <span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
              {preset.name}
            </span>
          </div>
          <p className='text-xs text-muted-foreground'>
            {preset.server} · {preset.profile}
          </p>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='-mr-1 -mt-1 size-7 shrink-0'
              onClick={(e) => e.stopPropagation()}
            >
              <DotsHorizontalIcon className='size-4' />
              <span className='sr-only'>Preset actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-40'>
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className='size-4' />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className='text-red-500!'
            >
              <Trash2 className='size-4' />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <dl className='grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs'>
        <div className='flex justify-between gap-2'>
          <dt className='text-muted-foreground'>Time</dt>
          <dd className='font-mono'>{preset.timeLimit}</dd>
        </div>
        <div className='flex justify-between gap-2'>
          <dt className='text-muted-foreground'>Data</dt>
          <dd className='font-mono'>{formatDataLimit(preset)}</dd>
        </div>
        <div className='flex justify-between gap-2'>
          <dt className='text-muted-foreground'>Validity</dt>
          <dd className='font-mono'>{preset.validity}</dd>
        </div>
        <div className='flex justify-between gap-2'>
          <dt className='text-muted-foreground'>Mode</dt>
          <dd className='font-mono uppercase'>{preset.userMode}</dd>
        </div>
        <div className='col-span-2 flex justify-between gap-2 border-t pt-1.5'>
          <dt className='text-muted-foreground'>Selling Price</dt>
          <dd className='font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'>
            {formatIDR(preset.sellingPrice)}
          </dd>
        </div>
      </dl>
    </button>
  )
}
