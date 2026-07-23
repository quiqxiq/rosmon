import { type Row } from '@tanstack/react-table'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { KeyRound, Pencil, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { useReconcileSubscription } from '../api/queries'
import { type Subscription } from '../data/schema'
import { useSubscriptionsContext } from './subscriptions-provider'

type DataTableRowActionsProps = {
  row: Row<Subscription>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const sub = row.original
  const { setOpen, setCurrentRow } = useSubscriptionsContext()
  const reconcileMutation = useReconcileSubscription()
  const role = useAuthStore((s) => s.auth.user?.role)
  if (role === 'viewer') return null
  const canRevealPassword = role === 'admin' || role === 'operator'

  const handleReconcile = () => {
    reconcileMutation.mutate(sub.id, {
      onSuccess: (res) =>
        toast.success(`Reconciled '${sub.mikrotik_username}'`, {
          description: res.warning,
        }),
      onError: (err) =>
        toast.error('Reconcile failed', { description: parseAPIError(err) }),
    })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='flex h-8 w-8 p-0 ml-auto'>
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(sub)
            setOpen('edit')
          }}
        >
          <Pencil className='size-4' />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(sub)
            setOpen('status')
          }}
        >
          <SlidersHorizontal className='size-4' />
          Change Status
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleReconcile}
          disabled={reconcileMutation.isPending}
        >
          <RefreshCw className='size-4' />
          Reconcile
        </DropdownMenuItem>
        {canRevealPassword && (
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(sub)
              setOpen('password')
            }}
          >
            <KeyRound className='size-4' />
            Lihat Password
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(sub)
            setOpen('delete')
          }}
          className='text-red-500!'
        >
          <Trash2 className='size-4' />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
