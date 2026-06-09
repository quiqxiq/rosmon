import { useActiveRouterId } from '@/stores/active-router-store'
import { PasswordRevealDialog } from '@/components/password-reveal-dialog'
import { revealHotspotUserPassword } from '../api/service'
import { useUsersDialogStore } from '../store/users-dialog-store'
import { UserDeleteDialog } from './user-delete-dialog'
import { UserMutateDrawer } from './user-mutate-drawer'

export function UserDialogs() {
  const mode = useUsersDialogStore((s) => s.mode)
  const target = useUsersDialogStore((s) => s.target)
  const close = useUsersDialogStore((s) => s.close)
  const routerId = useActiveRouterId() ?? 0

  return (
    <>
      <UserMutateDrawer />
      <UserDeleteDialog />

      {target && (
        <PasswordRevealDialog
          open={mode === 'password'}
          onOpenChange={(v) => {
            if (!v) close()
          }}
          title={`Password hotspot user — ${target.name}`}
          description='Password /ip/hotspot/user langsung di MikroTik. Untuk mengubah, gunakan Edit.'
          reveal={() => revealHotspotUserPassword(routerId, target.id)}
        />
      )}
    </>
  )
}
