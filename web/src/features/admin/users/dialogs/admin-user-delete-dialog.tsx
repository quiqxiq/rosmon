import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useDeleteAdminUser } from '../api/queries'
import { useAdminUsersDialogStore } from '../store/admin-users-dialog-store'

export function AdminUserDeleteDialog() {
  const { mode, target, close } = useAdminUsersDialogStore()
  const currentUserId = useAuthStore((s) => s.auth.user?.id)
  const deleteMut = useDeleteAdminUser()

  const isOpen = mode === 'delete'
  // Block deleting the currently signed-in account. The backend already
  // enforces this with a 400, but failing fast in the UI avoids the
  // accidental "log myself out" footgun and a useless network round trip.
  const isSelf = isOpen && target != null && target.id === currentUserId

  const handleConfirm = () => {
    if (!target) return
    deleteMut.mutate(target.id, {
      onSuccess: () => {
        toast.success(`User '${target.username}' deleted`)
        close()
      },
      onError: (err) => {
        toast.error('Failed to delete user', { description: err.message })
      },
    })
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSelf
              ? 'Cannot delete your own account'
              : `Delete '${target?.username}'?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSelf
              ? 'You are signed in as this user. Switch to another admin account first.'
              : 'This user will be soft-deleted. The username becomes available again, but historical audit logs keep the original reference.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMut.isPending}>
            {isSelf ? 'OK' : 'Cancel'}
          </AlertDialogCancel>
          {!isSelf && (
            <Button
              variant='destructive'
              onClick={handleConfirm}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && (
                <Loader2 className='size-4 animate-spin' />
              )}
              Delete
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
