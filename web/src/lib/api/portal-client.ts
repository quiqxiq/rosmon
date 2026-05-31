import axios from 'axios'
import { usePortalAuthStore } from '@/stores/portal-auth-store'

const rawBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export const portalApiClient = axios.create({
  baseURL: `${rawBase.replace(/\/+$/, '')}/api/v1`,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

portalApiClient.interceptors.request.use((config) => {
  const token = usePortalAuthStore.getState().customerToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: clear customer token and redirect to portal login.
// No refresh flow — customer tokens have 24h TTL.
let redirecting = false
portalApiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !redirecting) {
      redirecting = true
      usePortalAuthStore.getState().reset()
      window.location.replace('/portal/login')
    }
    return Promise.reject(error)
  },
)
