import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { useLogout } from '@/features/auth/api/queries'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const refreshToken = useAuthStore((s) => s.auth.refreshToken)
  const logoutMutation = useLogout()

  const handleSignOut = () => {
    // Call the server to revoke tokens. useLogout handles local cleanup
    // in onSettled regardless of API success/failure.
    logoutMutation.mutate(refreshToken || undefined)

    // Always clear local state and redirect immediately
    // (useLogout.onSettled also calls clearSession, but we navigate
    //  right away for instant UX — the mutation runs in background)
    const currentPath = location.href
    navigate({
      to: '/sign-in',
      search: { redirect: currentPath },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Sign out'
      desc='Are you sure you want to sign out? You will need to sign in again to access your account.'
      confirmText='Sign out'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
