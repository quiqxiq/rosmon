import { create } from 'zustand'
import { type RouterPPPProfile } from '../api/schema'

type DialogMode = 'add' | 'edit' | 'delete' | null

type ProfilesDialogState = {
  mode: DialogMode
  target: RouterPPPProfile | null
  open: (mode: Exclude<DialogMode, null>, target?: RouterPPPProfile) => void
  close: () => void
}

export const useProfilesDialogStore = create<ProfilesDialogState>()((set) => ({
  mode: null,
  target: null,
  open: (mode, target) => set({ mode, target: target ?? null }),
  close: () => set({ mode: null, target: null }),
}))
