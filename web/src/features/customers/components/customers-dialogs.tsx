import { PasswordRevealDialog } from '@/components/password-reveal-dialog'
import * as svc from '../api/service'
import { useCustomers } from './customers-provider'
import { CustomerMutateDrawer } from './customer-mutate-drawer'
import { CustomersDeleteDialog } from './customers-delete-dialog'

export function CustomersDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useCustomers()

  return (
    <>
      <CustomerMutateDrawer />

      {currentRow && (
        <CustomersDeleteDialog
          open={open === 'delete'}
          onOpenChange={(v) => {
            if (!v) {
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }
          }}
          currentRow={currentRow}
        />
      )}

      {currentRow && (
        <PasswordRevealDialog
          open={open === 'password'}
          onOpenChange={(v) => {
            if (!v) {
              setOpen(null)
              setTimeout(() => setCurrentRow(null), 500)
            }
          }}
          title={`Password portal — ${currentRow.full_name}`}
          description='Kredensial login customer portal (nomor HP + password).'
          reveal={() => svc.revealPortalPassword(currentRow.id)}
          reset={() => svc.resetPortalPassword(currentRow.id)}
        />
      )}
    </>
  )
}
