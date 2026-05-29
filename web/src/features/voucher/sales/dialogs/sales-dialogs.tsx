import { ImportSalesDialog } from './import-sales-dialog'
import { RecordSaleDialog } from './record-sale-dialog'

// Single mounting point for the sales-page dialogs. Each dialog reads
// its own visibility from `useSalesDialogStore`, so this wrapper is
// effectively just a "render both, they'll decide if they're open".
// Pattern mirrors `voucher/print/dialogs/preset-dialogs.tsx`.
export function SalesDialogs() {
  return (
    <>
      <RecordSaleDialog />
      <ImportSalesDialog />
    </>
  )
}
