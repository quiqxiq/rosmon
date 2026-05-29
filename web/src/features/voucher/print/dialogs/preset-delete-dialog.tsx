import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRemoveQuickPrintPackage } from '@/features/voucher/print/api/queries'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useQuickPrintPresetsMetaStore } from '@/stores/quick-print-presets-meta-store'
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
import { usePresetsDialogStore } from '../store/presets-dialog-store'

export function PresetDeleteDialog() {
  const { mode, target, close } = usePresetsDialogStore()
  const routerId = useActiveRouterId()
  // The backend uses the package `name` as the path id. Pass it
  // straight through; meta cleanup happens after a successful delete.
  const removeMutation = useRemoveQuickPrintPackage(routerId ?? 0)
  const removeMeta = useQuickPrintPresetsMetaStore((s) => s.remove)

  const isOpen = mode === 'delete'

  const handleConfirm = () => {
    if (!target) {
      close()
      return
    }
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }
    removeMutation.mutate(target.name, {
      onSuccess: () => {
        removeMeta(target.name)
        toast.success(`Preset '${target.name}' deleted`)
        close()
      },
      onError: (err) => {
        toast.error('Failed to delete preset', { description: err.message })
      },
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete preset?</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `Preset '${target.name}' (${target.package}) will be permanently removed.`
              : 'This preset will be removed.'}{' '}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={removeMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={removeMutation.isPending}
            className='gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {removeMutation.isPending && (
              <Loader2 className='size-4 animate-spin' />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
