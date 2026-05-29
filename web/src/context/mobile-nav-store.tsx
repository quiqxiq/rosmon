import { createContext, useCallback, useContext, useState } from 'react'

/* eslint-disable react-refresh/only-export-components */
const STORAGE_KEY = 'mikhmon-mobile-nav'
const MAX_ITEMS = 5

export const DEFAULT_MOBILE_NAV_ITEMS = [
  'dashboard',
  'hotspot',
  'voucher',
  'traffic',
  'settings',
] as const

export type MobileNavItemId =
  | 'dashboard'
  | 'hotspot'
  | 'voucher'
  | 'traffic'
  | 'log'
  | 'report'
  | 'settings'
  | 'help-center'

function loadItems(): MobileNavItemId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as MobileNavItemId[]
      }
    }
  } catch {
    // ignore
  }
  return [...DEFAULT_MOBILE_NAV_ITEMS] as MobileNavItemId[]
}

type MobileNavContextType = {
  items: MobileNavItemId[]
  add: (id: MobileNavItemId) => void
  remove: (id: MobileNavItemId) => void
  moveUp: (id: MobileNavItemId) => void
  moveDown: (id: MobileNavItemId) => void
  reorder: (activeId: MobileNavItemId, overId: MobileNavItemId) => void
  reset: () => void
  maxItems: number
}

const MobileNavContext = createContext<MobileNavContextType | null>(null)

type MobileNavProviderProps = {
  children: React.ReactNode
}

export function MobileNavProvider({ children }: MobileNavProviderProps) {
  const [items, setItems] = useState<MobileNavItemId[]>(loadItems)

  const persist = useCallback((next: MobileNavItemId[]) => {
    setItems(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const add = useCallback(
    (id: MobileNavItemId) => {
      setItems((prev) => {
        if (prev.includes(id) || prev.length >= MAX_ITEMS) return prev
        const next = [...prev, id]
        persist(next)
        return next
      })
    },
    [persist]
  )

  const remove = useCallback(
    (id: MobileNavItemId) => {
      setItems((prev) => {
        const next = prev.filter((i) => i !== id)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const moveUp = useCallback(
    (id: MobileNavItemId) => {
      setItems((prev) => {
        const idx = prev.indexOf(id)
        if (idx <= 0) return prev
        const next = [...prev]
        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
        persist(next)
        return next
      })
    },
    [persist]
  )

  const moveDown = useCallback(
    (id: MobileNavItemId) => {
      setItems((prev) => {
        const idx = prev.indexOf(id)
        if (idx < 0 || idx >= prev.length - 1) return prev
        const next = [...prev]
        ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
        persist(next)
        return next
      })
    },
    [persist]
  )

  const reorder = useCallback(
    (activeId: MobileNavItemId, overId: MobileNavItemId) => {
      if (activeId === overId) return
      setItems((prev) => {
        const from = prev.indexOf(activeId)
        const to = prev.indexOf(overId)
        if (from < 0 || to < 0) return prev
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const reset = useCallback(() => {
    persist([...DEFAULT_MOBILE_NAV_ITEMS] as MobileNavItemId[])
  }, [persist])

  return (
    <MobileNavContext
      value={{
        items,
        add,
        remove,
        moveUp,
        moveDown,
        reorder,
        reset,
        maxItems: MAX_ITEMS,
      }}
    >
      {children}
    </MobileNavContext>
  )
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext)
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider')
  return ctx
}
