import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'

// Admin section is gated by the real auth store role. Backend exposes only
// `admin` and `staff` — staff users get bounced to /403.
export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: () => {
    const role = useAuthStore.getState().auth.user?.role
    if (role !== 'admin') {
      throw redirect({ to: '/403' })
    }
  },
  component: Outlet,
})
