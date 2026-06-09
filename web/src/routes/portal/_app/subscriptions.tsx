import { createFileRoute } from '@tanstack/react-router'
import { PortalSubscriptions } from '@/features/customer-portal/subscriptions'

export const Route = createFileRoute('/portal/_app/subscriptions')({
  component: PortalSubscriptions,
})
