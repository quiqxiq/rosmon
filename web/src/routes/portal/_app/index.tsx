import { createFileRoute } from '@tanstack/react-router'
import { PortalHome } from '@/features/customer-portal/home'

export const Route = createFileRoute('/portal/_app/')({
  component: PortalHome,
})
