import { create } from 'zustand'
import { type Registration } from '../api/schema'

// Action-oriented dialog store: each lifecycle action opens its own dialog.
type DialogMode = 'approve' | 'reject' | 'assign' | 'complete' | null

type State = {
  mode: DialogMode
  target: Registration | null
  open: (mode: Exclude<DialogMode, null>, target: Registration) => void
  close: () => void
}

export const useRegistrationsDialogStore = create<State>()((set) => ({
  mode: null,
  target: null,
  open: (mode, target) => set({ mode, target }),
  close: () => set({ mode: null, target: null }),
}))
