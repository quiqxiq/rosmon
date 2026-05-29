import { type ColumnDef } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { formatIDR } from '@/lib/format'
import { parseAPIError } from '@/lib/api/errors'
import { useRemoveHotspotDbProfile } from '../api/queries'
import { useHotspotBillingDialogStore } from '../store/dialog-store'
import { type HotspotDbProfile } from '../api/schema'

function RowActions({
  profile,
  routerId,
}: {
  profile: HotspotDbProfile
  routerId: number
}) {
  const openDialog = useHotspotBillingDialogStore((s) => s.open)
  const removeMutation = useRemoveHotspotDbProfile(routerId)
  return (
    <div className='flex justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-8'
        onClick={() => openDialog('edit', profile)}
        aria-label='Edit'
      >
        <Pencil className='size-4' />
      </Button>
      <ConfirmDeleteButton
        title='Remove profile?'
        description={`Profile '${profile.name}' will be removed. Subscriptions using it must be reassigned first.`}
        pending={removeMutation.isPending}
        onConfirm={async () => {
          try {
            await removeMutation.mutateAsync(profile.id)
            toast.success(`Profile '${profile.name}' removed`)
          } catch (err) {
            toast.error('Failed to remove profile', {
              description: parseAPIError(err),
            })
          }
        }}
      />
    </div>
  )
}

export function makeColumns(routerId: number): ColumnDef<HotspotDbProfile, unknown>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Name' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-col'>
          <span className='font-semibold'>{row.original.name}</span>
          {row.original.description ? (
            <span className='text-xs text-muted-foreground'>
              {row.original.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'permanent' ? 'online' : 'offline'}>
          {row.original.role}
        </Badge>
      ),
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'rate_limit',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Rate Limit' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {row.original.rate_limit || '—'}
        </span>
      ),
    },
    {
      id: 'price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Price' />
      ),
      cell: ({ row }) => {
        const p = row.original
        const value =
          p.role === 'permanent' ? (p.price_monthly ?? 0) : (p.sell_price ?? 0)
        return (
          <span className='font-medium'>
            {value > 0
              ? `${formatIDR(value)}${p.role === 'permanent' ? '/mo' : ''}`
              : '—'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => <RowActions profile={row.original} routerId={routerId} />,
    },
  ]
}
