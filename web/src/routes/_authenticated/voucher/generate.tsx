import { createFileRoute } from '@tanstack/react-router'
import { VoucherGenerate } from '@/features/voucher/generate'

export const Route = createFileRoute('/_authenticated/voucher/generate')({
  component: VoucherGenerate,
})
