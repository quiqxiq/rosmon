import { create } from 'zustand'

const PORTAL_TOKEN_KEY = 'rosmon-portal-token'

export interface PortalUser {
  id: number
  phone: string
}

function decodePortalUser(token: string): PortalUser | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as {
      cid?: number
      phn?: string
      typ?: string
    }
    if (claims.typ !== 'customer_access' || !claims.cid || !claims.phn) return null
    return { id: claims.cid, phone: claims.phn }
  } catch {
    return null
  }
}

interface PortalAuthState {
  customerToken: string
  customerUser: PortalUser | null
  setToken: (token: string) => void
  reset: () => void
}

export const usePortalAuthStore = create<PortalAuthState>()((set) => {
  const stored = localStorage.getItem(PORTAL_TOKEN_KEY) ?? ''
  return {
    customerToken: stored,
    customerUser: stored ? decodePortalUser(stored) : null,
    setToken: (token) => {
      localStorage.setItem(PORTAL_TOKEN_KEY, token)
      set({ customerToken: token, customerUser: decodePortalUser(token) })
    },
    reset: () => {
      localStorage.removeItem(PORTAL_TOKEN_KEY)
      set({ customerToken: '', customerUser: null })
    },
  }
})
