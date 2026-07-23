import { create } from 'zustand'
import { type PPPSecret } from '../api/schema'

type DialogMode = 'add' | 'edit' | 'delete' | 'multi-delete' | 'password' | null

type SecretsDialogState = {
  mode: DialogMode
  target: PPPSecret | null
  ids: string[]
  open: (mode: Exclude<DialogMode, null>, target?: PPPSecret, ids?: string[]) => void
  close: () => void
}

export const useSecretsDialogStore = create<SecretsDialogState>()((set) => ({
  mode: null,
  target: null,
  ids: [],
  open: (mode, target, ids) => set({ mode, target: target ?? null, ids: ids ?? [] }),
  close: () => set({ mode: null, target: null, ids: [] }),
}))
