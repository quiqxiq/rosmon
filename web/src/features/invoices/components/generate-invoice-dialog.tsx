import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/date-picker'
import { useCustomers } from '@/features/customers/api/queries'
import { useSubscriptions } from '@/features/subscriptions/api/queries'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGenerateInvoice } from '../api/queries'

const schema = z.object({
  subscription_id: z.string().min(1, 'Pilih langganan'),
  amount: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && +v > 0), 'Jumlah harus angka > 0'),
  period_start: z.date().refine((d) => d instanceof Date, 'Pilih tanggal mulai'),
  due_days: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerateInvoiceDialog({ open, onOpenChange }: Props) {
  const generateMutation = useGenerateInvoice()
  const subsQuery = useSubscriptions()
  const customersQuery = useCustomers()

  const customerMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of customersQuery.data ?? []) m.set(c.id, c.full_name)
    return m
  }, [customersQuery.data])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subscription_id: '',
      amount: '',
      period_start: undefined,
      due_days: '7',
    },
  })

  const subs = subsQuery.data ?? []
  const isLoading = subsQuery.isLoading || customersQuery.isLoading

  function onSubmit(values: FormValues) {
    const sub = subs.find((s) => s.id === +values.subscription_id)
    generateMutation.mutate(
      {
        subscription_id: +values.subscription_id,
        customer_id: sub?.customer_id ?? 0,
        amount: values.amount ? +values.amount : undefined,
        period_start: format(values.period_start, 'yyyy-MM-dd'),
        due_days: values.due_days ? +values.due_days : undefined,
      },
      {
        onSuccess: (inv) => {
          toast.success(`Invoice ${inv.invoice_number} berhasil dibuat`)
          form.reset()
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error('Gagal membuat invoice', { description: err.message })
        },
      },
    )
  }

  function handleClose() {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Buat Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>

            <FormField
              control={form.control}
              name='subscription_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pelanggan / Langganan</FormLabel>
                  {isLoading ? (
                    <Skeleton className='h-9 w-full' />
                  ) : (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Pilih pelanggan...' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subs.length === 0 ? (
                          <SelectItem value='__none' disabled>
                            Belum ada langganan aktif
                          </SelectItem>
                        ) : (
                          subs.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {customerMap.get(s.customer_id) ?? `#${s.customer_id}`}
                              {' — '}
                              {s.mikrotik_username}
                              <span className='ml-1 text-xs opacity-60'>
                                ({s.service_type === 'pppoe' ? 'PPPoE' : 'Hotspot'})
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
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
                    <Input
                      type='number'
                      min={1}
                      placeholder='Kosongkan = harga paket otomatis'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Kosongkan untuk memakai harga paket langganan. Isi hanya untuk
                    tagihan nominal khusus.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='period_start'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mulai Periode</FormLabel>
                  <FormControl>
                    <DatePicker
                      selected={field.value}
                      onSelect={field.onChange}
                      placeholder='Pilih tanggal'
                    />
                  </FormControl>
                  <FormDescription>Tanggal awal periode tagihan.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='due_days'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jatuh Tempo (hari)</FormLabel>
                  <FormControl>
                    <Input type='number' min={1} max={90} className='w-24' {...field} />
                  </FormControl>
                  <FormDescription>Dari tanggal invoice. Default 7 hari.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-2 pt-2'>
              <Button type='button' variant='outline' onClick={handleClose}>
                Batal
              </Button>
              <Button type='submit' disabled={generateMutation.isPending}>
                {generateMutation.isPending && (
                  <Loader2 className='mr-2 size-4 animate-spin' />
                )}
                Buat Invoice
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
