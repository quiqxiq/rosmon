import { create } from 'zustand'
import { type RouterPublicView } from '../api/schema'

type Mode = 'closed' | 'create' | 'edit' | 'delete'

type RoutersDialogState = {
  mode: Mode
  selectedRouter: RouterPublicView | null
  open: (mode: Mode, router?: RouterPublicView) => void
  close: () => void
}

export const useRoutersDialogStore = create<RoutersDialogState>()((set) => ({
  mode: 'closed',
  selectedRouter: null,
  open: (mode, router) =>
    set({
      mode,
      selectedRouter: router ?? null,
    }),
  close: () => set({ mode: 'closed', selectedRouter: null }),
}))
