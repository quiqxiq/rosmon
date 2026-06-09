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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatIDR } from '@/lib/format'
import { useConfirmPayment, useRejectPayment } from '../api/queries'
import type { Payment } from '../api/schema'

type Props = {
  payment: Payment | null
  mode: 'confirm' | 'reject'
  onClose: () => void
}

export function ConfirmRejectDialog({ payment, mode, onClose }: Props) {
  const [reason, setReason] = useState('')
  const confirmMutation = useConfirmPayment()
  const rejectMutation = useRejectPayment()

  const isPending = confirmMutation.isPending || rejectMutation.isPending

  function handleAction() {
    if (!payment) return
    if (mode === 'confirm') {
      confirmMutation.mutate(payment.id, {
        onSuccess: () => {
          toast.success(`Pembayaran #${payment.id} dikonfirmasi`)
          onClose()
        },
        onError: (err) => toast.error('Gagal konfirmasi', { description: err.message }),
      })
    } else {
      rejectMutation.mutate(
        { id: payment.id, reason: reason || undefined },
        {
          onSuccess: () => {
            toast.success(`Pembayaran #${payment.id} ditolak`)
            onClose()
          },
          onError: (err) => toast.error('Gagal menolak', { description: err.message }),
        },
      )
    }
  }

  return (
    <Dialog open={payment !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'confirm' ? 'Konfirmasi Pembayaran' : 'Tolak Pembayaran'}
          </DialogTitle>
          {payment && (
            <DialogDescription>
              Pembayaran {formatIDR(payment.amount)} ·{' '}
              {payment.method === 'cash' ? 'Tunai' : payment.method === 'manual_transfer' ? 'Transfer' : 'Online'}
            </DialogDescription>
          )}
        </DialogHeader>

        {mode === 'reject' && (
          <div className='space-y-1.5'>
            <Label htmlFor='reason'>Alasan Penolakan (opsional)</Label>
            <Input
              id='reason'
              placeholder='Bukti tidak valid, nominal kurang...'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button
            variant={mode === 'reject' ? 'destructive' : 'default'}
            onClick={handleAction}
            disabled={isPending}
          >
            {isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
            {mode === 'confirm' ? 'Konfirmasi' : 'Tolak'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
