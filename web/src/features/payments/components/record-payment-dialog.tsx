import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatIDR } from '@/lib/format'
import { useCreatePayment } from '../api/queries'

const schema = z.object({
  method: z.enum(['cash', 'transfer']),
  amount: z.string().regex(/^\d+$/, 'Harus angka').refine(v => +v > 0, 'Jumlah harus > 0'),
  reference_number: z.string().optional(),
  bank_name: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: number
  customerId: number
  defaultAmount: number
  invoiceNumber: string
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  customerId,
  defaultAmount,
  invoiceNumber,
}: Props) {
  const createMutation = useCreatePayment()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: 'cash',
      amount: String(defaultAmount),
      reference_number: '',
      bank_name: '',
    },
  })

  const method = form.watch('method')

  function onSubmit(values: FormValues) {
    createMutation.mutate(
      {
        invoice_id: invoiceId,
        customer_id: customerId,
        amount: +values.amount,
        method: values.method,
        reference_number: values.reference_number || undefined,
        bank_name: values.bank_name || undefined,
      },
      {
        onSuccess: () => {
          const typeStr = values.method === 'cash' ? 'tunai' : 'transfer'
          toast.success(`Pembayaran ${typeStr} ${invoiceNumber} berhasil dicatat`)
          form.reset()
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error('Gagal mencatat pembayaran', { description: err.message })
        },
      },
    )
  }

  const isPending = createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Catat Pembayaran</DialogTitle>
          <DialogDescription>
            Invoice {invoiceNumber} — {formatIDR(defaultAmount)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='method'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metode Pembayaran</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='cash'>Tunai (Cash) — langsung dikonfirmasi</SelectItem>
                      <SelectItem value='transfer'>Transfer Bank — langsung dikonfirmasi</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jumlah (Rp)</FormLabel>
                  <FormControl>
                    <Input type='number' min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {method === 'transfer' && (
              <>
                <FormField
                  control={form.control}
                  name='bank_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Bank</FormLabel>
                      <FormControl>
                        <Input placeholder='BCA, Mandiri, BRI...' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='reference_number'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No. Referensi</FormLabel>
                      <FormControl>
                        <Input placeholder='Nomor bukti transfer (opsional)' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className='flex justify-end gap-2 pt-2'>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
                Batal
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 size-4 animate-spin' />}
                Simpan & Konfirmasi
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
