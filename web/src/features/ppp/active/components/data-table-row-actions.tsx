import { useState } from 'react'
import { type Row } from '@tanstack/react-table'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { parseAPIError } from '@/lib/api/errors'
import { useDisconnectPPPActive } from '../api/queries'
import { type PPPActive } from '../api/schema'

type DataTableRowActionsProps = {
  row: Row<PPPActive>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const session = row.original
  const routerId = useActiveRouterId() ?? 0
  const disconnectMutation = useDisconnectPPPActive(routerId)
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    try {
      await disconnectMutation.mutateAsync(session.id)
      toast.success(`Disconnected '${session.name}'`)
    } catch (err) {
      toast.error('Failed to disconnect', { description: parseAPIError(err) })
    }
    setOpen(false)
  }

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        className='h-8'
        onClick={() => setOpen(true)}
      >
        Disconnect
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect session?</AlertDialogTitle>
            <AlertDialogDescription>
              Session '{session.name}' will be disconnected from RouterOS. The
              client may reconnect automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={disconnectMutation.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
