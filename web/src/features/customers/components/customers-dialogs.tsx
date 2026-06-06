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
    </>
  )
}
