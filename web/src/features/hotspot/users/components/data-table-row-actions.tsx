import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Copy, Pencil, Power, RotateCw, Trash2 } from 'lucide-react'
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
import {
  useResetHotspotUserCounters,
  useUpdateHotspotUser,
} from '../api/queries'
import { useUsersDialogStore } from '../store/users-dialog-store'
import { type HotspotUserViewModel } from './view-model'

type DataTableRowActionsProps = {
  row: Row<HotspotUserViewModel>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const user = row.original
  const openDialog = useUsersDialogStore((s) => s.open)
  const routerId = useActiveRouterId() ?? 0
  const updateMutation = useUpdateHotspotUser(routerId)
  const resetMutation = useResetHotspotUserCounters(routerId)

  const handleCopyVoucher = () => {
    navigator.clipboard.writeText(`${user.name}\n${user.password}`)
    toast.success('Copied', {
      description: `${user.name} credentials copied`,
    })
  }

  // Flip the RouterOS `disabled` flag. RouterOS expects literal "true" /
  // "false" strings — convert the enum view-model value back to the API
  // shape before sending. Optimistic UX is provided by the mutation's
  // onSuccess invalidating the list.
  const handleToggleEnabled = () => {
    const next = user.enabledStatus === 'enabled' ? 'true' : 'false'
    updateMutation.mutate(
      { id: user.id, patch: { disabled: next } },
      {
        onSuccess: () => {
          toast.success(
            user.enabledStatus === 'enabled'
              ? `${user.name} disabled`
              : `${user.name} enabled`,
          )
        },
        onError: (err) => {
          toast.error('Failed to update user', {
            description: err instanceof Error ? err.message : String(err),
          })
        },
      },
    )
  }

  const handleResetCounters = () => {
    resetMutation.mutate(user.id, {
      onSuccess: () => {
        toast.success(`Counters reset for ${user.name}`)
      },
      onError: (err) => {
        toast.error('Failed to reset counters', {
          description: err instanceof Error ? err.message : String(err),
        })
      },
    })
  }

  const handleEdit = () => {
    openDialog('edit', { target: user })
  }

  const handleRemove = () => {
    openDialog('delete', { target: user })
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
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className='size-4' />
          Edit User
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyVoucher}>
          <Copy className='size-4' />
          Copy Credentials
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleToggleEnabled}
          disabled={updateMutation.isPending}
        >
          <Power className='size-4' />
          {user.enabledStatus === 'enabled' ? 'Disable' : 'Enable'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleResetCounters}
          disabled={resetMutation.isPending}
        >
          <RotateCw className='size-4' />
          Reset Counters
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleRemove} className='text-red-500!'>
          <Trash2 className='size-4' />
          Remove User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
