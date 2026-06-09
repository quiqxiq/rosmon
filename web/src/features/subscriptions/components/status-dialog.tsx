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
import { useSubscriptionsContext } from './subscriptions-provider'

export function StatusDialog() {
  const { open, setOpen, currentRow, setCurrentRow } = useSubscriptionsContext()
  const isOpen = open === 'status'
  const onClose = () => {
    setOpen(null)
    setTimeout(() => {
      setCurrentRow(null)
    }, 500)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {isOpen && currentRow && (
          <StatusForm onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatusForm({ onClose }: { onClose: () => void }) {
  const { currentRow } = useSubscriptionsContext()
  const patchMutation = usePatchSubscriptionStatus()
  const [status, setStatus] = useState<string>(currentRow?.status ?? 'active')

  const handleConfirm = () => {
    if (!currentRow) return
    patchMutation.mutate(
      { id: currentRow.id, status },
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
          Update the lifecycle state of '{currentRow?.mikrotik_username}'. This
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
