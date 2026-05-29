import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRoutersDialogStore } from '../store/routers-dialog-store'
import type { RouterPublicView } from '../api/schema'

type DataTableRowActionsProps = {
  row: Row<RouterPublicView>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const router = row.original
  const openDialog = useRoutersDialogStore((s) => s.open)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem onClick={() => openDialog('edit', router)}>
          <Pencil className='size-4' />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openDialog('delete', router)}
          className='text-red-500!'
        >
          <Trash2 className='size-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
