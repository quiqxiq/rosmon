import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { PresetColor } from '@/features/voucher/print/data/schema'

// Backend's QuickPrintPackage is all strings and has no place for the
// UI-only metadata our cards display: a tinted accent color and a
// human-friendly display label that's distinct from the internal name.
//
// Rather than smuggle these into a backend `comment` field (which
// already carries domain-meaningful voucher comments), we keep them in
// localStorage keyed by the package `name`. The `name` is the natural
// primary key from the backend's perspective — same key we PUT/DELETE
// against — so meta survives renames cleanly via a paired update at the
// mutation call site.

type PresetMeta = {
  color: PresetColor
  packageLabel: string
}

type PresetsMetaState = {
  byName: Record<string, PresetMeta>
  set: (name: string, meta: PresetMeta) => void
  rename: (oldName: string, newName: string) => void
  remove: (name: string) => void
  clear: () => void
}

export const useQuickPrintPresetsMetaStore = create<PresetsMetaState>()(
  persist(
    (set) => ({
      byName: {},
      set: (name, meta) =>
        set((state) => ({
          byName: { ...state.byName, [name]: meta },
        })),
      rename: (oldName, newName) =>
        set((state) => {
          if (oldName === newName) return state
          const meta = state.byName[oldName]
          if (!meta) return state
          const { [oldName]: _removed, ...rest } = state.byName
          return { byName: { ...rest, [newName]: meta } }
        }),
      remove: (name) =>
        set((state) => {
          const { [name]: _removed, ...rest } = state.byName
          return { byName: rest }
        }),
      clear: () => set({ byName: {} }),
    }),
    {
      name: 'roskit-quick-print-presets-meta',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// Deterministic fallback color when no meta is stored. Hashes the name
// to one of the 10 supported colors so first-time-seen presets still
// look distinct without a manual color pick.
const COLOR_PALETTE: PresetColor[] = [
  'blue',
  'indigo',
  'purple',
  'pink',
  'red',
  'amber',
  'green',
  'teal',
  'cyan',
  'sky',
]

export function defaultColorFor(name: string): PresetColor {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}
