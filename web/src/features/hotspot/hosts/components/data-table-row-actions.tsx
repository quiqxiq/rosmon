import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Copy, Link2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useHostsDialogStore } from '../store/hosts-dialog-store'
import { type HotspotHostViewModel } from './view-model'

type DataTableRowActionsProps = {
  row: Row<HotspotHostViewModel>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const host = row.original
  const openDialog = useHostsDialogStore((s) => s.open)

  const handleCopyMac = () => {
    navigator.clipboard.writeText(host.macAddress)
    toast.success('Copied', { description: `MAC ${host.macAddress} copied` })
  }

  const handleMakeBinding = () => {
    openDialog('bind', { target: host })
  }

  const handleRemove = () => {
    openDialog('delete', { target: host })
  }

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
      <DropdownMenuContent align='end' className='w-44'>
        <DropdownMenuItem onClick={handleCopyMac} disabled={!host.macAddress}>
          <Copy className='size-4' />
          Copy MAC
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMakeBinding}>
          <Link2 className='size-4' />
          Make IP Binding
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleRemove} className='text-red-500!'>
          <Trash2 className='size-4' />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
