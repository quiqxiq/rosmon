import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Most router-scoped endpoints live under `/routers/:routerId/...` — e.g.
// `/routers/:routerId/hotspot/users`, `/routers/:routerId/vouchers/generate`.
// The UI needs a single place to track which router the user is currently
// operating on. We persist to localStorage so a page refresh keeps the
// same router selected; a user can have many routers provisioned.
//
// The value is the backend DB id (uint in Go, number on the wire). `null`
// means "no router selected yet" — feature hooks must gate themselves with
// `enabled: routerId != null` to avoid issuing requests against `/routers/0`.

type ActiveRouterState = {
  routerId: number | null
  setRouterId: (id: number | null) => void
  clear: () => void
}

export const useActiveRouterStore = create<ActiveRouterState>()(
  persist(
    (set) => ({
      routerId: null,
      setRouterId: (id) => set({ routerId: id }),
      clear: () => set({ routerId: null }),
    }),
    {
      name: 'roskit-active-router',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

// Ergonomic selector for query consumers. Intentionally returns the raw
// value (not a truthy `number`) so callers can disable their queries via
// `enabled: routerId != null` without guessing at sentinel values.
export function useActiveRouterId(): number | null {
  return useActiveRouterStore((s) => s.routerId)
}
