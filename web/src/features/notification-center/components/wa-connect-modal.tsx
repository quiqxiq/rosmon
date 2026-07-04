import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, RefreshCw, Smartphone, X } from 'lucide-react'
import { toast } from 'sonner'
import { parseAPIError } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLogoutWhatsApp, useWhatsAppQR, useWhatsAppStatus } from '../api/queries'

interface WaConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WaConnectModal({ open, onOpenChange }: WaConnectModalProps) {
  const statusQuery = useWhatsAppStatus()
  const connected = statusQuery.data?.connected ?? false
  const jid = statusQuery.data?.jid ?? ''

  const qrQuery = useWhatsAppQR(open && !connected)
  const logoutMut = useLogoutWhatsApp()

  function handleLogout() {
    logoutMut.mutate(undefined, {
      onSuccess: () => {
        toast.success('Berhasil logout dari WhatsApp')
      },
      onError: (err) =>
        toast.error('Gagal logout', { description: parseAPIError(err) }),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Smartphone className='size-5 text-emerald-500' />
            {connected ? 'WhatsApp Terhubung' : 'Hubungkan WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            {connected
              ? `Akun terpasang: ${jid}`
              : 'Scan QR code dengan WhatsApp → Perangkat Tertaut → Tautkan Perangkat'}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-4 py-2'>
          {connected ? (
            <>
              <div className='flex size-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950'>
                <Smartphone className='size-10 text-emerald-500' />
              </div>
              <p className='text-center text-sm text-muted-foreground'>
                Gateway aktif dan siap mengirim notifikasi.
              </p>
              <Button
                variant='destructive'
                size='sm'
                className='gap-1.5'
                disabled={logoutMut.isPending}
                onClick={handleLogout}
              >
                {logoutMut.isPending && <Loader2 className='size-4 animate-spin' />}
                Cabut Perangkat (Logout)
              </Button>
            </>
          ) : qrQuery.isLoading ? (
            <div className='flex h-56 items-center justify-center'>
              <Loader2 className='size-8 animate-spin text-muted-foreground' />
            </div>
          ) : qrQuery.data?.code ? (
            <>
              <div className='rounded-xl bg-white p-4 shadow-sm ring-1 ring-border'>
                <QRCodeSVG value={qrQuery.data.code} size={220} />
              </div>
              <p className='text-center text-xs text-muted-foreground'>
                QR code berputar setiap 20 detik
              </p>
              <Button
                variant='outline'
                size='sm'
                className='gap-1.5'
                onClick={() => qrQuery.refetch()}
              >
                <RefreshCw className='size-4' />
                Refresh QR
              </Button>
            </>
          ) : (
            <div className='flex h-56 flex-col items-center justify-center gap-2 text-center'>
              <X className='size-8 text-destructive' />
              <p className='text-sm text-muted-foreground'>
                {qrQuery.isError ? parseAPIError(qrQuery.error) : 'Menunggu QR…'}
              </p>
              <Button variant='outline' size='sm' onClick={() => qrQuery.refetch()}>
                Coba Lagi
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
