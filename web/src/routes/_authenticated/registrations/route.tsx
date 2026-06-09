import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'

// Registrations are staff-facing: admin + operator may review/approve/install.
// Viewers are read-only elsewhere and bounced here.
export const Route = createFileRoute('/_authenticated/registrations')({
  beforeLoad: () => {
    const role = useAuthStore.getState().auth.user?.role
    if (role !== 'admin' && role !== 'operator') {
      throw redirect({ to: '/403' })
    }
  },
  component: Outlet,
})
