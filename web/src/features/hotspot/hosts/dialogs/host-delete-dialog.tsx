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
import { useRemoveHotspotHost } from '../api/queries'
import { useHostsDialogStore } from '../store/hosts-dialog-store'

export function HostDeleteDialog() {
  const { mode, target, ids, close } = useHostsDialogStore()
  const routerId = useActiveRouterId() ?? 0
  const removeMutation = useRemoveHotspotHost(routerId)

  const isOpen = mode === 'delete' || mode === 'multi-delete'

  const handleConfirm = async () => {
    if (mode === 'delete' && target) {
      try {
        await removeMutation.mutateAsync(target.id)
        toast.success(`Host ${target.macAddress || target.id} removed`)
      } catch (err) {
        toast.error('Failed to remove host', {
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
        toast.success(`Removed ${ok} host${ok > 1 ? 's' : ''}`)
      } else if (ok === 0) {
        toast.error(`Failed to remove ${failed} host${failed > 1 ? 's' : ''}`)
      } else {
        toast.warning(
          `Removed ${ok}, failed ${failed} of ${results.length} hosts`,
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
              ? `Remove ${ids.length} host${ids.length > 1 ? 's' : ''}?`
              : 'Remove host entry?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === 'multi-delete'
              ? 'Selected host entries will be removed from the cache. RouterOS will re-learn them on the next packet.'
              : target
                ? `Host ${target.macAddress || target.id} (${target.address || 'no address'}) will be removed from the cache.`
                : 'This host will be removed.'}
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
