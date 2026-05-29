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
import { useRemoveHotspotProfile } from '../api/queries'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'

export function ProfileDeleteDialog() {
  const { mode, target, ids, close } = useProfilesDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemoveHotspotProfile(routerId)

  const isOpen = mode === 'delete' || mode === 'multi-delete'

  const handleConfirm = async () => {
    if (mode === 'delete' && target) {
      try {
        await removeMutation.mutateAsync(target.id)
        toast.success(`Profile '${target.name}' deleted`)
      } catch (err) {
        toast.error('Failed to delete profile', {
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
        toast.success(`Deleted ${ok} profile${ok > 1 ? 's' : ''}`)
      } else if (ok === 0) {
        toast.error(`Failed to delete ${failed} profile${failed > 1 ? 's' : ''}`)
      } else {
        toast.warning(
          `Deleted ${ok}, failed ${failed} of ${results.length} profiles`,
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
              ? `Delete ${ids.length} profile${ids.length > 1 ? 's' : ''}?`
              : 'Delete profile?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'multi-delete'
              ? 'Selected profiles will be permanently removed. Existing users on these profiles will be orphaned.'
              : target
                ? `Profile '${target.name}' will be permanently removed.`
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
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
