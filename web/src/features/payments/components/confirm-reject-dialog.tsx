import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
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
import { Separator } from '@/components/ui/separator'
import { formatIDR } from '@/lib/format'
import { useConfirmPayment, useRejectPayment } from '../api/queries'
import type { Payment } from '../api/schema'

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')

type Props = {
  payment: Payment | null
  mode: 'confirm' | 'reject'
  onClose: () => void
}

export function ConfirmRejectDialog({ payment, mode, onClose }: Props) {
  const [reason, setReason] = useState('')
  const confirmMutation = useConfirmPayment()
  const rejectMutation = useRejectPayment()
  const token = useAuthStore((s) => s.auth.accessToken)

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

  const proofUrl = payment?.proof_url
    ? `${API_BASE}${payment.proof_url}?access_token=${encodeURIComponent(token)}`
    : null

  const isPdf = payment?.proof_url?.toLowerCase().endsWith('.pdf')
  const methodLabel =
    payment?.method === 'cash'
      ? 'Tunai'
      : payment?.method === 'transfer'
        ? 'Transfer'
        : payment?.method === 'portal'
          ? 'Portal'
          : 'Online'

  return (
    <Dialog open={payment !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'confirm' ? 'Konfirmasi Pembayaran' : 'Tolak Pembayaran'}
          </DialogTitle>
          {payment && (
            <DialogDescription>
              {formatIDR(payment.amount)} · {methodLabel}
              {payment.bank_name && ` · ${payment.bank_name}`}
              {payment.reference_number && (
                <span className='ml-1 font-mono text-xs'>#{payment.reference_number}</span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Bukti Pembayaran — hanya tampil untuk method portal dengan proof_url */}
        {proofUrl && (
          <>
            <Separator />
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <p className='text-sm font-medium'>Bukti Transfer</p>
                <a
                  href={proofUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex items-center gap-1 text-xs text-primary hover:underline'
                >
                  <ExternalLink className='size-3' />
                  Buka penuh
                </a>
              </div>
              {isPdf ? (
                <div className='flex items-center justify-center rounded-lg border bg-muted/30 p-6'>
                  <a
                    href={proofUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex flex-col items-center gap-2 text-primary hover:underline'
                  >
                    <ExternalLink className='size-8' />
                    <span className='text-xs'>Lihat PDF Bukti Transfer</span>
                  </a>
                </div>
              ) : (
                <div className='overflow-hidden rounded-lg border bg-muted/20'>
                  <img
                    src={proofUrl}
                    alt='Bukti Transfer'
                    className='max-h-64 w-full object-contain'
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.removeAttribute('hidden')
                    }}
                  />
                  <p hidden className='p-3 text-center text-xs text-muted-foreground'>
                    Gagal memuat gambar bukti.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {mode === 'reject' && (
          <>
            {proofUrl && <Separator />}
            <div className='space-y-1.5'>
              <Label htmlFor='reason'>Alasan Penolakan (opsional)</Label>
              <Input
                id='reason'
                placeholder='Bukti tidak valid, nominal kurang...'
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </>
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
