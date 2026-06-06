import { useSubscriptionsContext } from './subscriptions-provider'
import { SubscriptionMutateDrawer } from './subscription-mutate-drawer'
import { StatusDialog } from './status-dialog'
import { SubscriptionsDeleteDialog } from './subscriptions-delete-dialog'

export function SubscriptionsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useSubscriptionsContext()

  return (
    <>
      <SubscriptionMutateDrawer />
      <StatusDialog />

      {currentRow && (
        <SubscriptionsDeleteDialog
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
