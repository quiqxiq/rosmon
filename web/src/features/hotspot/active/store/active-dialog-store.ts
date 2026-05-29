import { create } from 'zustand'
import { type HotspotActiveViewModel } from '../components/view-model'

type DialogMode = 'disconnect' | 'disconnect-many' | 'disconnect-all' | null

type ActiveDialogState = {
  mode: DialogMode
  target: HotspotActiveViewModel | null
  ids: string[]
  open: (
    mode: Exclude<DialogMode, null>,
    payload?: { target?: HotspotActiveViewModel; ids?: string[] }
  ) => void
  close: () => void
}

export const useActiveDialogStore = create<ActiveDialogState>()((set) => ({
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
