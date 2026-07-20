import { type ColumnDef } from '@tanstack/react-table'
import { RefreshCw, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { parseAPIError } from '@/lib/api/errors'
import { STATUS_TONE } from '../data/data'
import type { SubscriptionEnrichedItem, SubscriptionStatus } from '../api/schema'
import { useReconcileSubscription } from '../api/queries'
import { useSubscriptionsContext } from './subscriptions-provider'

// Komponen untuk satu baris — pakai hook di dalamnya (React rules)
function RowActions({ item }: { item: SubscriptionEnrichedItem }) {
  const { setOpen, setCurrentRow } = useSubscriptionsContext()
  const reconcile = useReconcileSubscription()

  function handleReconcile() {
    reconcile.mutate(item.subscription.id, {
      onSuccess: (res) =>
        toast.success(`Reconciled '${item.subscription.mikrotik_username}'`, {
          description: res.warning,
        }),
      onError: (err) =>
        toast.error('Reconcile failed', { description: parseAPIError(err) }),
    })
  }

  return (
    <div className='flex items-center justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-7'
        title='Change Status'
        onClick={() => {
          setCurrentRow(item.subscription)
          setOpen('status')
        }}
      >
        <SlidersHorizontal className='size-3.5' />
      </Button>
      <Button
        variant='ghost'
        size='icon'
        className='size-7'
        title='Reconcile'
        disabled={reconcile.isPending}
        onClick={handleReconcile}
      >
        <RefreshCw className={`size-3.5 ${reconcile.isPending ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className='flex items-center justify-center'>
      {online ? (
        <span className='relative flex size-2.5'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
          <span className='relative inline-flex size-2.5 rounded-full bg-emerald-500' />
        </span>
      ) : (
        <span className='size-2.5 rounded-full bg-muted-foreground/30' />
      )}
    </span>
  )
}

function SessionCell({ item }: { item: SubscriptionEnrichedItem }) {
  if (!item.session) {
    return (
      <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        <WifiOff className='size-3.5' />
        <span>offline</span>
      </span>
    )
  }
  const s = item.session
  return (
    <div className='flex flex-col gap-0.5'>
      <span className='flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
        <Wifi className='size-3.5' />
        {s.uptime || '—'}
      </span>
      {s.address && (
        <span className='font-mono text-[10px] text-muted-foreground'>{s.address}</span>
      )}
      {s.caller_id && (
        <span className='font-mono text-[10px] text-muted-foreground'>{s.caller_id}</span>
      )}
      {(s.bytes_in !== undefined || s.bytes_out !== undefined) && (
        <span className='text-[10px] text-muted-foreground'>
          ↓{formatBytes(s.bytes_in ?? 0)} ↑{formatBytes(s.bytes_out ?? 0)}
        </span>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`
}

function DriftBadge({ drift }: { drift: string }) {
  if (!drift) return null
  const label =
    drift === 'online_while_suspended'
      ? 'online/suspended'
      : drift === 'online_while_terminated'
        ? 'online/terminated'
        : drift
  return (
    <Badge variant='destructive' className='text-[10px] font-medium'>
      ⚠ {label}
    </Badge>
  )
}

export function makeMonitoringColumns(
  customerName: (id: number) => string,
): ColumnDef<SubscriptionEnrichedItem, unknown>[] {
  return [
    {
      id: 'online',
      header: () => <span className='sr-only'>Online</span>,
      cell: ({ row }) => (
        <OnlineDot online={row.original.session !== null} />
      ),
      meta: { className: 'w-8' },
    },
    {
      id: 'identity',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Username / Pelanggan' />,
      accessorFn: (row) => row.subscription.mikrotik_username,
      cell: ({ row }) => {
        const sub = row.original.subscription
        return (
          <div className='flex flex-col'>
            <span className='font-mono font-semibold text-sm'>{sub.mikrotik_username}</span>
            <span className='text-xs text-muted-foreground'>{customerName(sub.customer_id)}</span>
          </div>
        )
      },
      filterFn: (row, _id, value: string) =>
        row.original.subscription.mikrotik_username
          .toLowerCase()
          .includes(value.toLowerCase()),
    },
    {
      id: 'service_type',
      header: 'Service',
      accessorFn: (row) => row.subscription.service_type,
      cell: ({ row }) => (
        <Badge variant='outline' className='uppercase text-xs'>
          {row.original.subscription.service_type}
        </Badge>
      ),
      filterFn: (row, _id, value: string[]) =>
        value.includes(row.original.subscription.service_type),
    },
    {
      id: 'status',
      header: 'DB Status',
      accessorFn: (row) => row.subscription.status,
      cell: ({ row }) => {
        const s = row.original.subscription.status as SubscriptionStatus
        return (
          <Badge variant={STATUS_TONE[s] ?? 'offline'} className='text-xs'>
            {s}
          </Badge>
        )
      },
      filterFn: (row, _id, value: string[]) =>
        value.includes(row.original.subscription.status),
    },
    {
      id: 'session',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Sesi Aktif' />,
      cell: ({ row }) => <SessionCell item={row.original} />,
    },
    {
      id: 'drift',
      header: 'Drift',
      cell: ({ row }) => <DriftBadge drift={row.original.router_drift} />,
    },
    {
      id: 'sync',
      header: 'Sync',
      accessorFn: (row) => row.subscription.sync_status,
      cell: ({ row }) => {
        const sub = row.original.subscription
        const isError = sub.sync_status === 'error'
        return (
          <span
            className={`font-mono text-xs ${isError ? 'text-destructive' : 'text-muted-foreground'}`}
            title={sub.sync_notes}
          >
            {sub.sync_status || '—'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => <RowActions item={row.original} />,
    },
  ]
}
