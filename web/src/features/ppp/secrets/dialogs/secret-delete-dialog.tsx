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
import { useRemovePPPSecret, useBatchRemovePPPSecrets } from '../api/queries'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'

export function SecretDeleteDialog() {
  const { mode, target, ids, close } = useSecretsDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemovePPPSecret(routerId)
  const batchRemoveMutation = useBatchRemovePPPSecrets(routerId)

  const isOpen = mode === 'delete' || mode === 'multi-delete'

  const handleConfirm = async () => {
    if (mode === 'delete' && target) {
      try {
        await removeMutation.mutateAsync(target.id)
        toast.success(`Secret '${target.name}' removed`)
      } catch (err) {
        toast.error('Failed to remove secret', {
          description: parseAPIError(err),
        })
      }
      close()
      return
    }

    if (mode === 'multi-delete' && ids.length > 0) {
      try {
        const deletedCount = await batchRemoveMutation.mutateAsync(ids)
        toast.success(`Removed ${deletedCount} secret${deletedCount > 1 ? 's' : ''}`)
      } catch (err) {
        toast.error('Failed to remove secrets', {
          description: parseAPIError(err),
        })
      }
      close()
    }
  }

  const isPending = removeMutation.isPending || batchRemoveMutation.isPending

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'multi-delete'
              ? `Remove ${ids.length} secret${ids.length > 1 ? 's' : ''}?`
              : 'Remove PPP secret?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'multi-delete'
              ? 'Selected secrets will be permanently removed from RouterOS.'
              : target
                ? `Secret '${target.name}' will be permanently removed from RouterOS.`
                : 'This secret will be removed.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
