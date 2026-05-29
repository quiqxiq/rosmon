import { create } from 'zustand'
import { type PPPSecret } from '../api/schema'

type DialogMode = 'add' | 'edit' | 'delete' | null

type SecretsDialogState = {
  mode: DialogMode
  target: PPPSecret | null
  open: (mode: Exclude<DialogMode, null>, target?: PPPSecret) => void
  close: () => void
}

export const useSecretsDialogStore = create<SecretsDialogState>()((set) => ({
  mode: null,
  target: null,
  open: (mode, target) => set({ mode, target: target ?? null }),
  close: () => set({ mode: null, target: null }),
}))
