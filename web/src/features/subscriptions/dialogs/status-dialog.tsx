import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseAPIError } from '@/lib/api/errors'
import { usePatchSubscriptionStatus } from '../api/queries'
import { SUBSCRIPTION_STATUSES } from '../api/schema'
import { useSubscriptionsDialogStore } from '../store/dialog-store'

export function StatusDialog() {
  const { mode, target, close } = useSubscriptionsDialogStore()
  const isOpen = mode === 'status'

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        {isOpen && target && (
          <StatusForm key={target.id} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatusForm({ onClose }: { onClose: () => void }) {
  const target = useSubscriptionsDialogStore((s) => s.target)
  const patchMutation = usePatchSubscriptionStatus()
  const [status, setStatus] = useState<string>(target?.status ?? 'active')

  const handleConfirm = () => {
    if (!target) return
    patchMutation.mutate(
      { id: target.id, status },
      {
        onSuccess: (res) => {
          toast.success('Status updated', { description: res.warning })
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to update status', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change Status</DialogTitle>
        <DialogDescription>
          Update the lifecycle state of '{target?.mikrotik_username}'. This
          propagates to RouterOS (isolir/suspend toggles the secret).
        </DialogDescription>
      </DialogHeader>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DialogFooter>
        <Button variant='outline' size='sm' onClick={onClose}>
          Cancel
        </Button>
        <Button
          size='sm'
          onClick={handleConfirm}
          disabled={patchMutation.isPending}
          className='gap-1.5'
        >
          {patchMutation.isPending && (
            <Loader2 className='size-4 animate-spin' />
          )}
          Apply
        </Button>
      </DialogFooter>
    </>
  )
}
