import { createFileRoute, redirect } from '@tanstack/react-router'
import { usePortalAuthStore } from '@/stores/portal-auth-store'
import { PortalLayout } from '@/features/customer-portal/_shared/portal-layout'

export const Route = createFileRoute('/portal/_app')({
  beforeLoad: () => {
    const hasToken = Boolean(usePortalAuthStore.getState().customerToken)
    if (!hasToken) {
      throw redirect({ to: '/portal/login' })
    }
  },
  component: PortalLayout,
})
