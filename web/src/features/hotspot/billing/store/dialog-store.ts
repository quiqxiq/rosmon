import { create } from 'zustand'
import { type HotspotDbProfile } from '../api/schema'

type DialogMode = 'add' | 'edit' | 'delete' | null

type State = {
  mode: DialogMode
  target: HotspotDbProfile | null
  open: (mode: Exclude<DialogMode, null>, target?: HotspotDbProfile) => void
  close: () => void
}

export const useHotspotBillingDialogStore = create<State>()((set) => ({
  mode: null,
  target: null,
  open: (mode, target) => set({ mode, target: target ?? null }),
  close: () => set({ mode: null, target: null }),
}))
