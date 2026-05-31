import { createFileRoute } from '@tanstack/react-router'
import { InvoiceDetail } from '@/features/customer-portal/invoices/invoice-detail'

export const Route = createFileRoute('/portal/_app/invoices/$id')({
  component: InvoiceDetail,
})
