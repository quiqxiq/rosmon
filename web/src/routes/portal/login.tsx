import { createFileRoute } from '@tanstack/react-router'
import { PortalLoginPage } from '@/features/customer-portal/auth'

export const Route = createFileRoute('/portal/login')({
  component: PortalLoginPage,
})
