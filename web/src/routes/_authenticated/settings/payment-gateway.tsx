import { createFileRoute } from '@tanstack/react-router'
import { SettingsPaymentGateway } from '@/features/settings/payment-gateway'

export const Route = createFileRoute('/_authenticated/settings/payment-gateway')({
  component: SettingsPaymentGateway,
})
