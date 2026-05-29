import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
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
import { useCreateScript, useDeleteScript, useScripts } from '../api/queries'
import { type Script } from '../api/schema'

export function ScriptsTab() {
  const routerId = useActiveRouterId() ?? 0
  const scriptsQuery = useScripts(routerId)
  const deleteMutation = useDeleteScript(routerId)
  const [addOpen, setAddOpen] = useState(false)

  const columns: ColumnDef<Script, unknown>[] = [
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
      accessorKey: 'owner',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Owner' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.owner || '—'}</span>
      ),
    },
    {
      accessorKey: 'run_count',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Runs' />
      ),
      cell: ({ row }) => <span>{row.original.run_count}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ConfirmDeleteButton
          title='Remove script?'
          description={`Script '${row.original.name}' will be removed from RouterOS.`}
          pending={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(row.original.id)
              toast.success(`Script '${row.original.name}' removed`)
            } catch (err) {
              toast.error('Failed to remove script', {
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
          Add Script
        </Button>
      </div>
      <SimpleDataTable
        columns={columns}
        data={scriptsQuery.data ?? []}
        searchKey='name'
        searchPlaceholder='Search scripts...'
        emptyMessage='No scripts.'
      />
      <AddScriptDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        routerId={routerId}
      />
    </div>
  )
}

function AddScriptDialog({
  open,
  onClose,
  routerId,
}: {
  open: boolean
  onClose: () => void
  routerId: number
}) {
  const createMutation = useCreateScript(routerId)
  const [name, setName] = useState('')
  const [source, setSource] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !source.trim()) {
      toast.error('Name and source are required')
      return
    }
    createMutation.mutate(
      { name: name.trim(), source: source.trim() },
      {
        onSuccess: () => {
          toast.success(`Script '${name}' created`)
          setName('')
          setSource('')
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to create script', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Script</DialogTitle>
          <DialogDescription>
            Create a RouterOS /system/script entry.
          </DialogDescription>
        </DialogHeader>
        <form
          id='add-script-form'
          className='flex flex-col gap-3'
          onSubmit={handleSubmit}
        >
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='my-script'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs text-muted-foreground'>Source</Label>
            <Textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder=':log info "hello"'
              rows={6}
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
            form='add-script-form'
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
