import { createFileRoute } from '@tanstack/react-router'
import { PortalTickets } from '@/features/customer-portal/tickets'

export const Route = createFileRoute('/portal/_app/tickets')({
  component: PortalTickets,
})
