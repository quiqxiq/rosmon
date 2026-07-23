import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { KeyRound, Pencil, Power, Trash2 } from 'lucide-react'
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
import { useSetPPPSecretDisabled } from '../api/queries'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'
import { type PPPSecret } from '../api/schema'

type DataTableRowActionsProps = {
  row: Row<PPPSecret>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const secret = row.original
  const openDialog = useSecretsDialogStore((s) => s.open)
  const routerId = useActiveRouterId() ?? 0
  const disabledMutation = useSetPPPSecretDisabled(routerId)
  const role = useAuthStore((s) => s.auth.user?.role)
  if (role === 'viewer') return null
  const canRevealPassword = role === 'admin' || role === 'operator'

  const handleToggleEnabled = () => {
    const nextDisabled = !secret.disabled
    disabledMutation.mutate(
      { id: secret.id, disabled: nextDisabled },
      {
        onSuccess: () => {
          toast.success(
            nextDisabled
              ? `${secret.name} disabled`
              : `${secret.name} enabled`,
          )
        },
        onError: (err) => {
          toast.error('Failed to update secret', {
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
        <DropdownMenuItem onClick={() => openDialog('edit', secret)}>
          <Pencil className='size-4' />
          Edit Secret
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleToggleEnabled}
          disabled={disabledMutation.isPending}
        >
          <Power className='size-4' />
          {secret.disabled ? 'Enable' : 'Disable'}
        </DropdownMenuItem>
        {canRevealPassword && (
          <DropdownMenuItem onClick={() => openDialog('password', secret)}>
            <KeyRound className='size-4' />
            Lihat Password
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => openDialog('delete', secret)}
          className='text-red-500!'
        >
          <Trash2 className='size-4' />
          Remove Secret
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
