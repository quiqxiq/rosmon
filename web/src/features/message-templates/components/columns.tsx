import { type ColumnDef } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { useMessageTemplatesDialogStore } from '../store/dialog-store'
import { type MessageTemplate } from '../api/schema'

function RowActions({ template }: { template: MessageTemplate }) {
  const openDialog = useMessageTemplatesDialogStore((s) => s.open)
  return (
    <div className='flex justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-8'
        onClick={() => openDialog('edit', template)}
        aria-label='Edit template'
      >
        <Pencil className='size-4' />
      </Button>
    </div>
  )
}

export const columns: ColumnDef<MessageTemplate, unknown>[] = [
  {
    accessorKey: 'slug',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Slug' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.slug}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <span className='font-medium'>{row.original.name}</span>
    ),
  },
  {
    accessorKey: 'body',
    header: 'Preview',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='line-clamp-1 max-w-md text-sm text-muted-foreground'>
        {row.original.body}
      </span>
    ),
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.active ? 'online' : 'offline'}>
        {row.original.active ? 'active' : 'inactive'}
      </Badge>
    ),
    filterFn: (row, id, value) =>
      value.includes(String(row.getValue(id))),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RowActions template={row.original} />,
  },
]
