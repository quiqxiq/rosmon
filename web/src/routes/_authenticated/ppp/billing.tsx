import { createFileRoute } from '@tanstack/react-router'
import { PPPBilling } from '@/features/ppp/billing'

export const Route = createFileRoute('/_authenticated/ppp/billing')({
  component: PPPBilling,
})
