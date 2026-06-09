import { createFileRoute } from '@tanstack/react-router'
import { PortalProfile } from '@/features/customer-portal/profile'

export const Route = createFileRoute('/portal/_app/profile')({
  component: PortalProfile,
})
