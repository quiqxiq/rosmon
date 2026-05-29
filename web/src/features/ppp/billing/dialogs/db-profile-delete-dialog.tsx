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
import { parseAPIError } from '@/lib/api/errors'
import { useRemovePPPDbProfile } from '../api/queries'
import { useDbProfilesDialogStore } from '../store/db-profiles-dialog-store'

export function DbProfileDeleteDialog() {
  const { mode, target, close } = useDbProfilesDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemovePPPDbProfile(routerId)

  const isOpen = mode === 'delete'

  const handleConfirm = async () => {
    if (!target) return
    try {
      await removeMutation.mutateAsync(target.id)
      toast.success(`Profile '${target.name}' removed`)
    } catch (err) {
      toast.error('Failed to remove profile', {
        description: parseAPIError(err),
      })
    }
    close()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove billing profile?</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `Profile '${target.name}' will be removed. Subscriptions using it must be reassigned first.`
              : 'This profile will be removed.'}
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
