import { SecretDeleteDialog } from './secret-delete-dialog'
import { SecretMutateDrawer } from './secret-mutate-drawer'

export function SecretDialogs() {
  return (
    <>
      <SecretMutateDrawer />
      <SecretDeleteDialog />
    </>
  )
}
