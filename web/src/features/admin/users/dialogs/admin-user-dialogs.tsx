import { AdminUserDeleteDialog } from './admin-user-delete-dialog'
import { AdminUserMutateDialog } from './admin-user-mutate-dialog'

export function AdminUserDialogs() {
  return (
    <>
      <AdminUserMutateDialog />
      <AdminUserDeleteDialog />
    </>
  )
}
