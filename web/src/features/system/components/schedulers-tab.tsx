import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  useCreateScheduler,
  useDeleteScheduler,
  useSchedulers,
} from '../api/queries'
import { type Scheduler } from '../api/schema'

export function SchedulersTab() {
  const routerId = useActiveRouterId() ?? 0
  const schedulersQuery = useSchedulers(routerId)
  const deleteMutation = useDeleteScheduler(routerId)
  const [addOpen, setAddOpen] = useState(false)

  const columns: ColumnDef<Scheduler, unknown>[] = [
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
      accessorKey: 'interval',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Interval' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.interval || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'next_run',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Next Run' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.next_run || '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.disabled ? 'offline' : 'online'}>
          {row.original.disabled ? 'disabled' : 'enabled'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ConfirmDeleteButton
          title='Remove scheduler?'
          description={`Scheduler '${row.original.name}' will be removed from RouterOS.`}
          pending={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(row.original.id)
              toast.success(`Scheduler '${row.original.name}' removed`)
            } catch (err) {
              toast.error('Failed to remove scheduler', {
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
          Add Scheduler
        </Button>
      </div>
      <SimpleDataTable
        columns={columns}
        data={schedulersQuery.data ?? []}
        searchKey='name'
        searchPlaceholder='Search schedulers...'
        emptyMessage='No schedulers.'
      />
      <AddSchedulerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        routerId={routerId}
      />
    </div>
  )
}

function AddSchedulerDialog({
  open,
  onClose,
  routerId,
}: {
  open: boolean
  onClose: () => void
  routerId: number
}) {
  const createMutation = useCreateScheduler(routerId)
  const [name, setName] = useState('')
  const [interval, setInterval] = useState('')
  const [onEvent, setOnEvent] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    createMutation.mutate(
      {
        name: name.trim(),
        interval: interval.trim() || undefined,
        on_event: onEvent.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Scheduler '${name}' created`)
          setName('')
          setInterval('')
          setOnEvent('')
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to create scheduler', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Scheduler</DialogTitle>
          <DialogDescription>
            Create a RouterOS /system/scheduler entry.
          </DialogDescription>
        </DialogHeader>
        <form
          id='add-scheduler-form'
          className='flex flex-col gap-3'
          onSubmit={handleSubmit}
        >
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='nightly-task'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>Interval</Label>
            <Input
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              placeholder='1d 00:00:00'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>On Event</Label>
            <Textarea
              value={onEvent}
              onChange={(e) => setOnEvent(e.target.value)}
              placeholder='/system script run my-script'
              rows={4}
              className='font-mono text-xs'
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
            form='add-scheduler-form'
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
