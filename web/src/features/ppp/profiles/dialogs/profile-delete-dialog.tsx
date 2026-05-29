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
import { useRemovePPPProfile } from '../api/queries'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'

export function ProfileDeleteDialog() {
  const { mode, target, close } = useProfilesDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemovePPPProfile(routerId)

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
          <AlertDialogTitle>Remove PPP profile?</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `Profile '${target.name}' will be removed from RouterOS. Secrets using it must be reassigned.`
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
