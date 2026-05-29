import { createFileRoute } from '@tanstack/react-router'
import { VoucherPrint } from '@/features/voucher/print'

export const Route = createFileRoute('/_authenticated/voucher/print')({
  component: VoucherPrint,
})
