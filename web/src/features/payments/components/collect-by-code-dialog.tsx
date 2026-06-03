import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, Loader2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { formatIDR } from '@/lib/format'
import { useCollectByCode } from '../api/queries'
import type { CollectByCodeResult } from '../api/schema'

const schema = z.object({
  code: z.string().min(4, 'Masukkan kode bayar yang valid'),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectByCodeDialog({ open, onOpenChange }: Props) {
  const collectMutation = useCollectByCode()
  const [result, setResult] = useState<CollectByCodeResult | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  })

  function onSubmit(values: FormValues) {
    collectMutation.mutate(
      { code: values.code.trim().toUpperCase(), method: 'cash' },
      {
        onSuccess: (data) => {
          setResult(data)
        },
        onError: (err) => {
          form.setError('code', { message: err.message })
        },
      },
    )
  }

  function handleClose() {
    form.reset()
    setResult(null)
    collectMutation.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <QrCode className='size-5' />
            Terima Pembayaran
          </DialogTitle>
          <DialogDescription>
            Masukkan kode bayar dari invoice pelanggan.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className='space-y-4 py-2'>
            <div className='flex flex-col items-center gap-3 text-center'>
              <CheckCircle2 className='size-12 text-emerald-500' />
              <div>
                <p className='text-lg font-bold text-emerald-600'>
                  Pembayaran Berhasil!
                </p>
                <p className='text-sm text-muted-foreground'>
                  {result.invoice.invoice_number}
                </p>
              </div>
              <div className='rounded-lg border bg-muted/50 px-6 py-3 text-center'>
                <p className='text-xs text-muted-foreground'>Jumlah Diterima</p>
                <p className='text-2xl font-bold tabular-nums'>
                  {formatIDR(result.payment.amount)}
                </p>
              </div>
            </div>
            <Button className='w-full' onClick={handleClose}>
              Selesai
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='code'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Bayar</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Contoh: ABC12345'
                        autoFocus
                        autoComplete='off'
                        className='font-mono tracking-widest text-center text-lg uppercase'
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormDescription>
                      Kode ditemukan di invoice cetak atau portal pelanggan.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='flex gap-2'>
                <Button type='button' variant='outline' className='flex-1' onClick={handleClose}>
                  Batal
                </Button>
                <Button type='submit' className='flex-1' disabled={collectMutation.isPending}>
                  {collectMutation.isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
                  Konfirmasi
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
