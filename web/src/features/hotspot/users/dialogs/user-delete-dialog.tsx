import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
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
import { useRemoveHotspotUser } from '../api/queries'
import { useUsersDialogStore } from '../store/users-dialog-store'

export function UserDeleteDialog() {
  const { mode, target, ids, close } = useUsersDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemoveHotspotUser(routerId)

  const isOpen = mode === 'delete' || mode === 'multi-delete'

  // Bulk delete fans out individually because the API has no batch
  // endpoint. `Promise.allSettled` keeps a single failure from blocking
  // the rest of the selection; the summary toast surfaces partials.
  const handleConfirm = async () => {
    if (mode === 'delete' && target) {
      try {
        await removeMutation.mutateAsync(target.id)
        toast.success(`User '${target.name}' removed`)
      } catch (err) {
        toast.error('Failed to remove user', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
      close()
      return
    }
    if (mode === 'multi-delete' && ids.length > 0) {
      const results = await Promise.allSettled(
        ids.map((id) => removeMutation.mutateAsync(id)),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      const ok = results.length - failed
      if (failed === 0) {
        toast.success(`Removed ${ok} user${ok > 1 ? 's' : ''}`)
      } else if (ok === 0) {
        toast.error(`Failed to remove ${failed} user${failed > 1 ? 's' : ''}`)
      } else {
        toast.warning(
          `Removed ${ok}, failed ${failed} of ${results.length} users`,
        )
      }
      close()
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'multi-delete'
              ? `Remove ${ids.length} user${ids.length > 1 ? 's' : ''}?`
              : 'Remove user?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'multi-delete'
              ? 'Selected users will be permanently removed from RouterOS.'
              : target
                ? `User '${target.name}' will be permanently removed from RouterOS.`
                : 'This user will be removed.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={removeMutation.isPending}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
