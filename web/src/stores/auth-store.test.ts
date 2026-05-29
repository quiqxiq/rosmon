import { clearCookies } from '@/test-utils/cookies'
import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importAuthStore() {
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser = {
  id: 12,
  username: 'alice',
  role: 'admin' as const,
}

describe('useAuthStore', () => {
  beforeEach(() => {
    clearCookies()
    localStorage.removeItem('roskit-refresh-token')
    vi.resetModules()
  })

  it('starts with an empty access token when nothing is persisted', async () => {
    const useAuthStore = await importAuthStore()

    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('starts with an empty refresh token when nothing is persisted', async () => {
    const useAuthStore = await importAuthStore()
    expect(useAuthStore.getState().auth.refreshToken).toBe('')
  })

  it('persists access token so a new store instance reads it back', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setAccessToken('session-token')

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe(
      'session-token'
    )
  })

  it('persists refresh token to localStorage so a new store reads it back', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setRefreshToken('refresh-abc')

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.refreshToken).toBe('refresh-abc')
    expect(localStorage.getItem('roskit-refresh-token')).toBe('refresh-abc')
  })

  it('clears persisted access token when resetAccessToken is used', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setAccessToken('to-clear')
    useAuthStore.getState().auth.resetAccessToken()

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe('')
  })

  it('clears refresh token when resetRefreshToken is called', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setRefreshToken('to-clear')
    useAuthStore.getState().auth.resetRefreshToken()

    expect(useAuthStore.getState().auth.refreshToken).toBe('')
    expect(localStorage.getItem('roskit-refresh-token')).toBeNull()
  })

  it('updates the signed-in user via setUser', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().auth.setUser({ ...sampleUser })

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
  })

  it('reset clears user and access token and drops persistence', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setAccessToken('will-be-cleared')
    useAuthStore.getState().auth.setRefreshToken('will-be-cleared')
    useAuthStore.getState().auth.setUser({ ...sampleUser })

    useAuthStore.getState().auth.reset()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.refreshToken).toBe('')

    vi.resetModules()
    const useAuthStoreAfterReload = await importAuthStore()

    expect(useAuthStoreAfterReload.getState().auth.user).toBeNull()
    expect(useAuthStoreAfterReload.getState().auth.accessToken).toBe('')
    expect(useAuthStoreAfterReload.getState().auth.refreshToken).toBe('')
  })
})
