import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTableColumnHeader, SimpleDataTable } from '@/components/data-table'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { parseAPIError } from '@/lib/api/errors'
import { useCreatePool, useDeletePool, usePools } from '../api/queries'
import { type IPPool } from '../api/schema'

export function PoolsTab() {
  const routerId = useActiveRouterId() ?? 0
  const poolsQuery = usePools(routerId)
  const deleteMutation = useDeletePool(routerId)
  const [addOpen, setAddOpen] = useState(false)

  const columns: ColumnDef<IPPool, unknown>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Name' />
      ),
      cell: ({ row }) => (
        <span className='font-semibold'>{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'ranges',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Ranges' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.ranges || '—'}</span>
      ),
    },
    {
      id: 'usage',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Usage' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.used}/{row.original.total} ({row.original.available} free)
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ConfirmDeleteButton
          title='Remove IP pool?'
          description={`Pool '${row.original.name}' will be removed from RouterOS.`}
          pending={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(row.original.id)
              toast.success(`Pool '${row.original.name}' removed`)
            } catch (err) {
              toast.error('Failed to remove pool', {
                description: parseAPIError(err),
              })
            }
          }}
        />
      ),
    },
  ]

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end'>
        <Button size='sm' className='gap-1.5' onClick={() => setAddOpen(true)}>
          <Plus className='size-4' />
          Add Pool
        </Button>
      </div>
      <SimpleDataTable
        columns={columns}
        data={poolsQuery.data ?? []}
        searchKey='name'
        searchPlaceholder='Search pools...'
        emptyMessage='No IP pools.'
      />
      <AddPoolDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        routerId={routerId}
      />
    </div>
  )
}

function AddPoolDialog({
  open,
  onClose,
  routerId,
}: {
  open: boolean
  onClose: () => void
  routerId: number
}) {
  const createMutation = useCreatePool(routerId)
  const [name, setName] = useState('')
  const [ranges, setRanges] = useState('')
  const [nextPool, setNextPool] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !ranges.trim()) {
      toast.error('Name and ranges are required')
      return
    }
    createMutation.mutate(
      {
        name: name.trim(),
        ranges: ranges.trim(),
        next_pool: nextPool.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Pool '${name}' created`)
          setName('')
          setRanges('')
          setNextPool('')
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to create pool', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add IP Pool</DialogTitle>
          <DialogDescription>
            Create a RouterOS /ip/pool used by PPP / hotspot profiles.
          </DialogDescription>
        </DialogHeader>
        <form
          id='add-pool-form'
          className='flex flex-col gap-3'
          onSubmit={handleSubmit}
        >
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='hs-pool'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>Ranges</Label>
            <Input
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder='10.0.0.2-10.0.0.254'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>
              Next Pool (optional)
            </Label>
            <Input
              value={nextPool}
              onChange={(e) => setNextPool(e.target.value)}
              placeholder='none'
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancel
          </Button>
          <Button
            type='submit'
            size='sm'
            form='add-pool-form'
            disabled={createMutation.isPending}
            className='gap-1.5'
          >
            {createMutation.isPending && (
              <Loader2 className='size-4 animate-spin' />
            )}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
