import { create } from 'zustand'
import { type HotspotProfileViewModel } from '../components/view-model'

type DialogMode = 'add' | 'edit' | 'delete' | 'multi-delete' | null

type ProfilesDialogState = {
  mode: DialogMode
  target: HotspotProfileViewModel | null
  ids: string[]
  open: (
    mode: Exclude<DialogMode, null>,
    payload?: { target?: HotspotProfileViewModel; ids?: string[] }
  ) => void
  close: () => void
}

export const useProfilesDialogStore = create<ProfilesDialogState>()((set) => ({
  mode: null,
  target: null,
  ids: [],
  open: (mode, payload) =>
    set({
      mode,
      target: payload?.target ?? null,
      ids: payload?.ids ?? [],
    }),
  close: () => set({ mode: null, target: null, ids: [] }),
}))
