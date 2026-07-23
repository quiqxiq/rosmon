import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Pencil, Power, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { parseAPIError } from '@/lib/api/errors'
import { useUpdatePPPProfile } from '../api/queries'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'
import { type RouterPPPProfile } from '../api/schema'

type DataTableRowActionsProps = {
  row: Row<RouterPPPProfile>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const profile = row.original
  const openDialog = useProfilesDialogStore((s) => s.open)
  const routerId = useActiveRouterId() ?? 0
  const updateMutation = useUpdatePPPProfile(routerId)
  const role = useAuthStore((s) => s.auth.user?.role)
  if (role === 'viewer') return null

  const handleToggleEnabled = () => {
    const nextDisabled = !profile.disabled
    updateMutation.mutate(
      { id: profile.id, patch: { disabled: nextDisabled } },
      {
        onSuccess: () => {
          toast.success(
            nextDisabled
              ? `${profile.name} disabled`
              : `${profile.name} enabled`,
          )
        },
        onError: (err) => {
          toast.error('Failed to update profile', {
            description: parseAPIError(err),
          })
        },
      },
    )
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
        <DropdownMenuItem onClick={() => openDialog('edit', profile)}>
          <Pencil className='size-4' />
          Edit Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleToggleEnabled}
          disabled={updateMutation.isPending}
        >
          <Power className='size-4' />
          {profile.disabled ? 'Enable' : 'Disable'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => openDialog('delete', profile)}
          className='text-red-500!'
        >
          <Trash2 className='size-4' />
          Remove Profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
