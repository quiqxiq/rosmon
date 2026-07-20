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
import { useLogoutWhatsApp, useWhatsAppQR, useWhatsAppStatus, usePairWhatsAppPhone } from '../api/queries'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

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
  const pairMut = usePairWhatsAppPhone()

  const [method, setMethod] = useState<'qr' | 'phone'>('qr')
  const [phone, setPhone] = useState('')
  const [pairCode, setPairCode] = useState('')

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
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v)
      if (!v) {
        setMethod('qr')
        setPairCode('')
        setPhone('')
      }
    }}>
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
          ) : method === 'phone' ? (
            <div className='flex w-full flex-col gap-4 px-2'>
              <div className='space-y-1.5'>
                <Label>Nomor Telepon</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder='628123456789'
                />
                <p className='text-[11px] text-muted-foreground'>
                  Gunakan kode negara tanpa simbol +, misal 62 untuk Indonesia.
                </p>
              </div>
              <Button
                disabled={!phone || pairMut.isPending}
                onClick={() => {
                  pairMut.mutate(phone, {
                    onSuccess: (res) => setPairCode(res.code),
                    onError: (err) =>
                      toast.error('Gagal mendapatkan kode', {
                        description: parseAPIError(err),
                      }),
                  })
                }}
              >
                {pairMut.isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
                Dapatkan Kode Pairing
              </Button>
              {pairCode && (
                <div className='mt-2 flex flex-col items-center gap-2 rounded-lg bg-muted p-4 text-center'>
                  <p className='text-sm font-medium'>Masukkan kode ini di WhatsApp Anda:</p>
                  <p className='text-3xl font-mono font-bold tracking-[0.2em]'>{pairCode}</p>
                </div>
              )}
            </div>
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

          {!connected && (
            <Button
              variant='link'
              size='sm'
              className='mt-2 text-xs text-muted-foreground'
              onClick={() => {
                setMethod(method === 'qr' ? 'phone' : 'qr')
                setPairCode('')
              }}
            >
              {method === 'qr'
                ? 'Gunakan Tautkan dengan Nomor Telepon'
                : 'Gunakan QR Code'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
