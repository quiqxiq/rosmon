import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useDeleteRouter } from '../api/queries'
import { useRoutersDialogStore } from '../store/routers-dialog-store'

export function RoutersDeleteDialog() {
  const { mode, selectedRouter, close } = useRoutersDialogStore()
  const deleteMut = useDeleteRouter()

  const isOpen = mode === 'delete'

  const handleConfirm = () => {
    if (!selectedRouter) return
    deleteMut.mutate(selectedRouter.id, {
      onSuccess: () => {
        toast.success(`Router '${selectedRouter.name}' deleted`)
        close()
      },
      onError: (err) => {
        toast.error('Failed to delete router', { description: err.message })
      },
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &lsquo;{selectedRouter?.name}&rsquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This will soft-delete the router. Voucher sales associated with this router will be
            orphaned. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
          <Button
            variant='destructive'
            onClick={handleConfirm}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending && <Loader2 className='size-4 animate-spin' />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
