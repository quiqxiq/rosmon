import { create } from 'zustand'
import { type Subscription } from '../api/schema'

type DialogMode = 'add' | 'edit' | 'status' | null

type State = {
  mode: DialogMode
  target: Subscription | null
  open: (mode: Exclude<DialogMode, null>, target?: Subscription) => void
  close: () => void
}

export const useSubscriptionsDialogStore = create<State>()((set) => ({
  mode: null,
  target: null,
  open: (mode, target) => set({ mode, target: target ?? null }),
  close: () => set({ mode: null, target: null }),
}))
