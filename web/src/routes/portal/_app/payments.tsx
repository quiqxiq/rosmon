import { createFileRoute } from '@tanstack/react-router'
import { PaymentHistory } from '@/features/customer-portal/payments/payment-history'

export const Route = createFileRoute('/portal/_app/payments')({
  component: PaymentHistory,
})
