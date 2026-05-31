import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

// `VITE_API_URL` should point to the backend host (no `/api/v1` suffix).
// We append `/api/v1` here so per-feature service calls use bare paths
// like `/auth/login`, `/routers/:id/hotspot/users`, etc.
const rawBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const baseURL = `${rawBase.replace(/\/+$/, '')}/api/v1`

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

// Inject auth on every request. Backend is single-tenant — no tenant scoping.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ────── Refresh state (prevents concurrent refresh calls) ──────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else if (token) {
      resolve(token)
    }
  })
  failedQueue = []
}

// ────── Response interceptor: transparent token refresh on 401 ──────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Only attempt refresh for 401s that haven't been retried yet.
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/refresh') // don't refresh the refresh endpoint itself
    ) {
      return Promise.reject(error)
    }

    // If a refresh is already in flight, queue this request.
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return apiClient(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const rt = useAuthStore.getState().auth.refreshToken
      if (!rt) {
        // No refresh token — let the 401 bubble up.
        throw new Error('No refresh token')
      }

      const res = await apiClient.post<{ data: { access_token: string; refresh_token: string } }>(
        '/auth/refresh',
        { refresh_token: rt },
      )

      const { access_token, refresh_token } = res.data.data
      const { auth } = useAuthStore.getState()
      auth.setAccessToken(access_token)
      auth.setRefreshToken(refresh_token)

      processQueue(null, access_token)

      originalRequest.headers.Authorization = `Bearer ${access_token}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      // Refresh failed — reset auth and let the caller handle it.
      useAuthStore.getState().auth.reset()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

// Auth token injection happens in the request interceptor above.
// Token refresh (on 401) is handled by the response interceptor below.
