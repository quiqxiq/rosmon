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
import {
  useDisconnectHotspotUser,
  useHotspotActive,
} from '../api/queries'
import { useActiveDialogStore } from '../store/active-dialog-store'

export function DisconnectDialog() {
  const { mode, target, ids, close } = useActiveDialogStore()
  const routerId = useActiveRouterId() ?? 0
  // Used only to enumerate IDs for "disconnect all" — we read the
  // cached list rather than passing it through the dialog store so the
  // page header can stay slim.
  const activeQuery = useHotspotActive(routerId)
  const disconnectMutation = useDisconnectHotspotUser(routerId)

  const isOpen =
    mode === 'disconnect' ||
    mode === 'disconnect-many' ||
    mode === 'disconnect-all'

  const handleConfirm = async () => {
    if (mode === 'disconnect' && target) {
      try {
        await disconnectMutation.mutateAsync(target.id)
        toast.success(`${target.user || 'session'} disconnected`)
      } catch (err) {
        toast.error('Failed to disconnect', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
      close()
      return
    }
    const targetIds =
      mode === 'disconnect-all'
        ? (activeQuery.data ?? []).map((s) => s['.id'])
        : ids
    if (targetIds.length === 0) {
      close()
      return
    }
    const results = await Promise.allSettled(
      targetIds.map((id) => disconnectMutation.mutateAsync(id)),
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    const ok = results.length - failed
    if (failed === 0) {
      toast.success(`Disconnected ${ok} session${ok > 1 ? 's' : ''}`)
    } else if (ok === 0) {
      toast.error(
        `Failed to disconnect ${failed} session${failed > 1 ? 's' : ''}`,
      )
    } else {
      toast.warning(
        `Disconnected ${ok}, failed ${failed} of ${results.length} sessions`,
      )
    }
    close()
  }

  const allCount = activeQuery.data?.length ?? 0
  const titleCount =
    mode === 'disconnect-all'
      ? allCount
      : mode === 'disconnect-many'
        ? ids.length
        : 1

  const title =
    mode === 'disconnect-all'
      ? `Disconnect all ${allCount} sessions?`
      : mode === 'disconnect-many'
        ? `Disconnect ${ids.length} session${ids.length > 1 ? 's' : ''}?`
        : 'Disconnect session?'

  const description =
    mode === 'disconnect-all'
      ? 'Every active hotspot session will be terminated. Connected users must log in again.'
      : mode === 'disconnect-many'
        ? 'Selected sessions will be terminated. Affected users must log in again.'
        : target
          ? `Session for ${target.user || 'this user'} (${target.address || 'no address'}) will be terminated.`
          : 'This session will be terminated.'

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disconnectMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={titleCount === 0 || disconnectMutation.isPending}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
