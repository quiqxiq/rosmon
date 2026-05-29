import { create } from 'zustand'
import { type PPPDbProfile } from '../api/schema'

type DialogMode = 'add' | 'edit' | 'delete' | null

type DbProfilesDialogState = {
  mode: DialogMode
  target: PPPDbProfile | null
  open: (mode: Exclude<DialogMode, null>, target?: PPPDbProfile) => void
  close: () => void
}

export const useDbProfilesDialogStore = create<DbProfilesDialogState>()(
  (set) => ({
    mode: null,
    target: null,
    open: (mode, target) => set({ mode, target: target ?? null }),
    close: () => set({ mode: null, target: null }),
  }),
)
