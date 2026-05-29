import { create } from 'zustand'

// Sales-page dialog orchestration. Tracks which dialog (if any) is
// currently open. Mirrors the pattern used by `presets-dialog-store`
// so anyone familiar with the print presets page can read this in 10
// seconds.
//
// No target payload yet — neither Record nor Import operate on an
// existing row. If a future "Edit Sale" dialog appears (backend would
// need a PATCH endpoint first), this store grows a `target` field.

type SalesDialogKind = 'record' | 'import' | null

type SalesDialogState = {
  kind: SalesDialogKind
  open: (kind: Exclude<SalesDialogKind, null>) => void
  close: () => void
}

export const useSalesDialogStore = create<SalesDialogState>()((set) => ({
  kind: null,
  open: (kind) => set({ kind }),
  close: () => set({ kind: null }),
}))
