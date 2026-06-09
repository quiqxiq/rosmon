import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const ACCESS_TOKEN = 'roskit-access-token'
const REFRESH_TOKEN_KEY = 'roskit-refresh-token'

// Match service/auth/errors.go — backend RBAC has 3 roles in a hierarchy:
// admin > operator > viewer. The JWT access token carries `rol`.
export type UserRole = 'admin' | 'operator' | 'viewer'

// Match internal/services/auth_service.go#/UserView — the shape returned
// by /auth/me and embedded in /auth/login responses.
export interface AuthUser {
  id: number
  username: string
  role: UserRole
}

// Decode the user identity from a JWT access token so route guards have the
// role available synchronously after a page reload (the store is in-memory;
// only the token is persisted). Backend access tokens carry uid/usr/rol.
function decodeUserFromToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as {
      uid?: number
      usr?: string
      rol?: UserRole
    }
    if (!claims.usr || !claims.rol) return null
    return { id: claims.uid ?? 0, username: claims.usr, role: claims.rol }
  } catch {
    return null
  }
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    refreshToken: string
    setRefreshToken: (token: string) => void
    resetRefreshToken: () => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  const initToken = cookieState ? JSON.parse(cookieState) : ''
  const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY) ?? ''
  return {
    auth: {
      user: initToken ? decodeUserFromToken(initToken) : null,
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      refreshToken: storedRefresh,
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      setRefreshToken: (refreshToken) =>
        set((state) => {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
          return { ...state, auth: { ...state.auth, refreshToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      resetRefreshToken: () =>
        set((state) => {
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          return { ...state, auth: { ...state.auth, refreshToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          localStorage.removeItem(REFRESH_TOKEN_KEY)
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '', refreshToken: '' },
          }
        }),
    },
  }
})
