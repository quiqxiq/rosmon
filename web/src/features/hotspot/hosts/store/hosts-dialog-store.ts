import { create } from 'zustand'
import { type HotspotHostViewModel } from '../components/view-model'

type DialogMode = 'bind' | 'bind-many' | 'delete' | 'multi-delete' | null

type HostsDialogState = {
  mode: DialogMode
  target: HotspotHostViewModel | null
  ids: string[]
  // Per-id snapshot of the target hosts for bulk operations. Stored so
  // the make-binding dialog can read MAC/address per row without
  // re-querying the host list. Keyed by `.id` for O(1) lookup.
  bulk: Record<string, HotspotHostViewModel>
  open: (
    mode: Exclude<DialogMode, null>,
    payload?: {
      target?: HotspotHostViewModel
      ids?: string[]
      bulk?: HotspotHostViewModel[]
    }
  ) => void
  close: () => void
}

export const useHostsDialogStore = create<HostsDialogState>()((set) => ({
  mode: null,
  target: null,
  ids: [],
  bulk: {},
  open: (mode, payload) =>
    set({
      mode,
      target: payload?.target ?? null,
      ids: payload?.ids ?? [],
      bulk: Object.fromEntries(
        (payload?.bulk ?? []).map((h) => [h.id, h]),
      ),
    }),
  close: () => set({ mode: null, target: null, ids: [], bulk: {} }),
}))
