import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Bell, BellOff, Pencil, Trash2, Users } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'
import { type HotspotProfileViewModel } from './view-model'

type DataTableRowActionsProps = {
  row: Row<HotspotProfileViewModel>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const profile = row.original
  const openDialog = useProfilesDialogStore((s) => s.open)

  const handleEdit = () => {
    openDialog('edit', { target: profile })
  }

  // "Setup Monitor" requires installing/removing a scheduler on the
  // device — the dedicated backend endpoint for that lands in Phase 8.
  // For now this is a no-op with a clear toast so the surface stays
  // visible without lying to the user.
  const handleToggleMonitor = () => {
    toast.info('Coming soon', {
      description: profile.hasExpiredMonitor
        ? 'Remove monitor wiring lands in Phase 8.'
        : 'Setup monitor wiring lands in Phase 8.',
    })
  }

  const handleDelete = () => {
    openDialog('delete', { target: profile })
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
          Edit Profile
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to='/hotspot/users' className='flex items-center gap-2'>
            <Users className='size-4' />
            View Users
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleMonitor}>
          {profile.hasExpiredMonitor ? (
            <>
              <BellOff className='size-4' />
              Remove Monitor
            </>
          ) : (
            <>
              <Bell className='size-4' />
              Setup Monitor
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} className='text-red-500!'>
          <Trash2 className='size-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
