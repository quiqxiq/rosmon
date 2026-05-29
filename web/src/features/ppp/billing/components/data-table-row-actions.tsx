import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Pencil, Power, Trash2 } from 'lucide-react'
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
import { parseAPIError } from '@/lib/api/errors'
import { useUpdatePPPDbProfile } from '../api/queries'
import { useDbProfilesDialogStore } from '../store/db-profiles-dialog-store'
import { type PPPDbProfile } from '../api/schema'

type DataTableRowActionsProps = {
  row: Row<PPPDbProfile>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const profile = row.original
  const openDialog = useDbProfilesDialogStore((s) => s.open)
  const routerId = useActiveRouterId() ?? 0
  const updateMutation = useUpdatePPPDbProfile(routerId)

  const handleToggleActive = () => {
    const nextActive = !profile.active
    updateMutation.mutate(
      { id: profile.id, payload: { active: nextActive } },
      {
        onSuccess: () => {
          toast.success(
            nextActive
              ? `${profile.name} activated`
              : `${profile.name} deactivated`,
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
          onClick={handleToggleActive}
          disabled={updateMutation.isPending}
        >
          <Power className='size-4' />
          {profile.active ? 'Deactivate' : 'Activate'}
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
