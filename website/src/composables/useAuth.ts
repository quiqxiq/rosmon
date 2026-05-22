import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/auth'
import type { Credentials } from '@/types/auth'

export function useAuth() {
  const store = useAuthStore()
  const { accessToken, refreshToken, user, isAuthenticated, role } = storeToRefs(store)

  async function login(credentials: Credentials) {
    const tokens = await authService.login(credentials)
    store.setTokens(tokens)
    const me = await authService.me()
    store.setUser(me)
  }

  async function logout() {
    if (store.refreshToken) {
      try {
        await authService.logout(store.refreshToken)
      } catch {
        // ignore — local reset still proceeds
      }
    }
    store.reset()
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    role,
    login,
    logout,
  }
}
