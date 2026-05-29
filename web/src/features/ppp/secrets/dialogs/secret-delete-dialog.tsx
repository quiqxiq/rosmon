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
import { useRemovePPPSecret } from '../api/queries'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'

export function SecretDeleteDialog() {
  const { mode, target, close } = useSecretsDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemovePPPSecret(routerId)

  const isOpen = mode === 'delete'

  const handleConfirm = async () => {
    if (!target) return
    try {
      await removeMutation.mutateAsync(target.id)
      toast.success(`Secret '${target.name}' removed`)
    } catch (err) {
      toast.error('Failed to remove secret', {
        description: parseAPIError(err),
      })
    }
    close()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove PPP secret?</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `Secret '${target.name}' will be permanently removed from RouterOS.`
              : 'This secret will be removed.'}
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
