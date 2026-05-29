import { createFileRoute } from '@tanstack/react-router'
import { VoucherOverview } from '@/features/voucher'

export const Route = createFileRoute('/_authenticated/voucher/')({
  component: VoucherOverview,
})
