import * as React from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {
  return React.useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(MOBILE_QUERY)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}

const DESKTOP_BREAKPOINT = 1024
const DESKTOP_QUERY = `(min-width: ${DESKTOP_BREAKPOINT}px)`

/**
 * True ketika viewport ≥1024px (Tailwind `lg` breakpoint).
 * SSR-safe: default `false` saat server render.
 */
export function useIsDesktop() {
  return React.useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(DESKTOP_QUERY)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  )
}
