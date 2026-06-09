import { useActiveRouterId } from '@/stores/active-router-store'
import { PasswordRevealDialog } from '@/components/password-reveal-dialog'
import { revealPPPSecretPassword } from '../api/service'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'
import { SecretDeleteDialog } from './secret-delete-dialog'
import { SecretMutateDrawer } from './secret-mutate-drawer'

export function SecretDialogs() {
  const mode = useSecretsDialogStore((s) => s.mode)
  const target = useSecretsDialogStore((s) => s.target)
  const close = useSecretsDialogStore((s) => s.close)
  const routerId = useActiveRouterId() ?? 0

  return (
    <>
      <SecretMutateDrawer />
      <SecretDeleteDialog />

      {target && (
        <PasswordRevealDialog
          open={mode === 'password'}
          onOpenChange={(v) => {
            if (!v) close()
          }}
          title={`Password PPP secret — ${target.name}`}
          description='Password /ppp/secret langsung di MikroTik. Untuk mengubah, gunakan Edit.'
          reveal={() => revealPPPSecretPassword(routerId, target.id)}
        />
      )}
    </>
  )
}
