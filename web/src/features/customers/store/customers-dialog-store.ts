import { create } from 'zustand'
import { type Customer } from '../api/schema'

type DialogMode = 'add' | 'edit' | null

type CustomersDialogState = {
  mode: DialogMode
  target: Customer | null
  open: (mode: Exclude<DialogMode, null>, target?: Customer) => void
  close: () => void
}

export const useCustomersDialogStore = create<CustomersDialogState>()(
  (set) => ({
    mode: null,
    target: null,
    open: (mode, target) => set({ mode, target: target ?? null }),
    close: () => set({ mode: null, target: null }),
  }),
)
