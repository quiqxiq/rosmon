import { DbProfileDeleteDialog } from './db-profile-delete-dialog'
import { DbProfileMutateDrawer } from './db-profile-mutate-drawer'

export function DbProfileDialogs() {
  return (
    <>
      <DbProfileMutateDrawer />
      <DbProfileDeleteDialog />
    </>
  )
}
