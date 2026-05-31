import { createFileRoute } from '@tanstack/react-router'
import { InvoiceList } from '@/features/customer-portal/invoices/invoice-list'

export const Route = createFileRoute('/portal/_app/invoices/')({
  component: InvoiceList,
})
