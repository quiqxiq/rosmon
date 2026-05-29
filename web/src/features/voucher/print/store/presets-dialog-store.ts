import { create } from 'zustand'
import { type QuickPrintPreset } from '../data/schema'

type DialogMode = 'add' | 'edit' | 'delete' | null

type PresetsDialogState = {
  mode: DialogMode
  target: QuickPrintPreset | null
  open: (
    mode: Exclude<DialogMode, null>,
    payload?: { target?: QuickPrintPreset }
  ) => void
  close: () => void
}

export const usePresetsDialogStore = create<PresetsDialogState>()((set) => ({
  mode: null,
  target: null,
  open: (mode, payload) =>
    set({ mode, target: payload?.target ?? null }),
  close: () => set({ mode: null, target: null }),
}))
