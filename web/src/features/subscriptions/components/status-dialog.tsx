import { useState } from 'react'
import { Loader2, ShieldAlert, ShieldOff, ShieldCheck } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { parseAPIError } from '@/lib/api/errors'
import { usePatchSubscriptionStatus } from '../api/queries'
import { SUBSCRIPTION_STATUSES } from '../api/schema'
import { useSubscriptionsContext } from './subscriptions-provider'

// Deskripsi dampak setiap status target.
const STATUS_IMPACT: Record<
  string,
  { label: string; desc: string; variant: 'destructive' | 'default' | 'outline' }
> = {
  isolir: {
    label: 'Isolir',
    desc: 'Koneksi dibatasi ke profil kecepatan rendah (throttle). Pelanggan masih bisa connect tapi kecepatan sangat terbatas.',
    variant: 'default',
  },
  suspended: {
    label: 'Suspend Keras',
    desc: 'PPPoE secret di-disable di router. Pelanggan tidak bisa connect sama sekali sampai status dipulihkan.',
    variant: 'destructive',
  },
  active: {
    label: 'Aktifkan',
    desc: 'Pulihkan koneksi ke profil normal. Outbox akan push perubahan ke router secara background.',
    variant: 'outline',
  },
}

// Quick actions berdasarkan status saat ini.
const QUICK_ACTIONS: Record<string, string[]> = {
  active: ['isolir', 'suspended'],
  isolir: ['active', 'suspended'],
  suspended: ['active'],
  pending_install: [],
  terminated: [],
}

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
        {isOpen && currentRow && <StatusForm onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function StatusForm({ onClose }: { onClose: () => void }) {
  const { currentRow } = useSubscriptionsContext()
  const patchMutation = usePatchSubscriptionStatus()
  const [status, setStatus] = useState<string>(currentRow?.status ?? 'active')

  const currentStatus = currentRow?.status ?? ''
  const quickActions = QUICK_ACTIONS[currentStatus] ?? []

  const handleQuickAction = (targetStatus: string) => {
    if (!currentRow) return
    patchMutation.mutate(
      { id: currentRow.id, status: targetStatus },
      {
        onSuccess: (res) => {
          toast.success(`Status diubah ke ${targetStatus}`, { description: res.warning })
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal mengubah status', { description: parseAPIError(err) }),
      },
    )
  }

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
          toast.error('Failed to update status', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ubah Status Koneksi</DialogTitle>
        <DialogDescription>
          Langganan <strong>{currentRow?.mikrotik_username}</strong> — status saat ini:{' '}
          <code className='rounded bg-muted px-1 py-0.5 text-xs'>{currentStatus}</code>
        </DialogDescription>
      </DialogHeader>

      {/* Quick actions berdasarkan status saat ini */}
      {quickActions.length > 0 && (
        <div className='space-y-2'>
          <p className='text-sm font-medium'>Aksi Cepat</p>
          <div className='grid gap-2'>
            {quickActions.map((targetStatus) => {
              const info = STATUS_IMPACT[targetStatus]
              if (!info) return null
              const Icon =
                targetStatus === 'isolir'
                  ? ShieldAlert
                  : targetStatus === 'suspended'
                    ? ShieldOff
                    : ShieldCheck
              return (
                <div key={targetStatus} className='flex items-start gap-3 rounded-lg border p-3'>
                  <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                  <div className='flex-1 space-y-0.5'>
                    <p className='text-sm font-medium'>{info.label}</p>
                    <p className='text-xs text-muted-foreground'>{info.desc}</p>
                  </div>
                  <Button
                    size='sm'
                    variant={info.variant}
                    disabled={patchMutation.isPending}
                    onClick={() => handleQuickAction(targetStatus)}
                    className='shrink-0'
                    id={`quick-action-${targetStatus}`}
                  >
                    {patchMutation.isPending && (
                      <Loader2 className='mr-1 size-3 animate-spin' />
                    )}
                    {info.label}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Override manual (dropdown semua status) */}
      <div className='space-y-2'>
        <p className='text-sm font-medium text-muted-foreground'>Override Manual</p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id='subscription-status-select'>
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
      </div>

      <DialogFooter>
        <Button variant='outline' size='sm' onClick={onClose}>
          Batal
        </Button>
        <Button
          size='sm'
          onClick={handleConfirm}
          disabled={patchMutation.isPending || status === currentStatus}
          className='gap-1.5'
          id='subscription-status-apply-btn'
        >
          {patchMutation.isPending && <Loader2 className='size-4 animate-spin' />}
          Apply Override
        </Button>
      </DialogFooter>
    </>
  )
}
