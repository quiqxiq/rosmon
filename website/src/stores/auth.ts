import { defineStore } from 'pinia'
import type { AuthUser, TokenPair } from '@/types/auth'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
  }),
  getters: {
    isAuthenticated: (s) => Boolean(s.accessToken),
    role: (s) => s.user?.role ?? null,
  },
  actions: {
    setTokens(tokens: TokenPair) {
      this.accessToken = tokens.accessToken
      this.refreshToken = tokens.refreshToken
    },
    setUser(user: AuthUser | null) {
      this.user = user
    },
    reset() {
      this.accessToken = null
      this.refreshToken = null
      this.user = null
    },
  },
  persist: {
    pick: ['accessToken', 'refreshToken', 'user'],
  },
})
