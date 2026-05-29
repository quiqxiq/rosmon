import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Copy, Power, X } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRemoveHotspotActive } from '../api/queries'
import { useActiveDialogStore } from '../store/active-dialog-store'
import { type HotspotActiveViewModel } from './view-model'

type DataTableRowActionsProps = {
  row: Row<HotspotActiveViewModel>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const session = row.original
  const openDialog = useActiveDialogStore((s) => s.open)
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemoveHotspotActive(routerId)

  const handleDisconnect = () => {
    openDialog('disconnect', { target: session })
  }

  // "Remove session" drops the session WITHOUT clearing the captive
  // portal cookie, so the user can re-auth silently. "Disconnect"
  // (above) clears the cookie via the dedicated endpoint and forces a
  // re-login.
  const handleRemoveSession = () => {
    removeMutation.mutate(session.id, {
      onSuccess: () => {
        toast.success(`Session for ${session.user} removed`, {
          description: 'Cookie preserved — user can re-auth silently.',
        })
      },
      onError: (err) => {
        toast.error('Failed to remove session', {
          description: err instanceof Error ? err.message : String(err),
        })
      },
    })
  }

  const handleCopyMac = () => {
    navigator.clipboard.writeText(session.macAddress)
    toast.success('Copied', {
      description: `MAC ${session.macAddress} copied`,
    })
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
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem
          onClick={handleCopyMac}
          disabled={!session.macAddress}
        >
          <Copy className='size-4' />
          Copy MAC
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleRemoveSession}
          disabled={removeMutation.isPending}
        >
          <X className='size-4' />
          Remove (keep cookie)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDisconnect} className='text-red-500!'>
          <Power className='size-4' />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
