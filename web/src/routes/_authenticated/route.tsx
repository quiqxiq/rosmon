import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  // Read the token live from the store (not the router context, which is a
  // one-time startup snapshot) so navigation immediately after login passes
  // the guard instead of bouncing back to /sign-in.
  beforeLoad: ({ location }) => {
    const hasToken = Boolean(useAuthStore.getState().auth.accessToken)
    if (!hasToken) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: AuthenticatedLayout,
})
