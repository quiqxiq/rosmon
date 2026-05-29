import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  LoginRequest,
  LoginResult,
  LogoutRequest,
  RefreshRequest,
  UserView,
} from '../data/schema'

// Pure axios functions for /auth/*.
// All functions unwrap the backend Envelope<T> via `unwrap()` from
// `@/lib/api/unwrap`. Axios already throws on non-2xx; `unwrap` covers
// the rare 2xx-with-null-data case.

// POST /auth/login — exchange credentials for tokens.
export async function login(payload: LoginRequest): Promise<LoginResult> {
  const res = await apiClient.post<Envelope<LoginResult>>(
    '/auth/login',
    payload,
  )
  return unwrap(res.data)
}

// POST /auth/refresh — rotate token pair using a valid refresh token.
export async function refreshToken(
  payload: RefreshRequest,
): Promise<LoginResult> {
  const res = await apiClient.post<Envelope<LoginResult>>(
    '/auth/refresh',
    payload,
  )
  return unwrap(res.data)
}

// POST /auth/logout — revoke the current access token (and optional refresh).
// Backend returns `{ data: { message }, error: null }`; we don't need the
// message at the call site so the function returns void.
export async function logout(refreshToken?: string): Promise<void> {
  const body: LogoutRequest = refreshToken
    ? { refresh_token: refreshToken }
    : {}
  await apiClient.post<Envelope<{ message: string }>>('/auth/logout', body)
}

// GET /auth/me — fetch the authenticated user identity.
export async function getMe(): Promise<UserView> {
  const res = await apiClient.get<Envelope<UserView>>('/auth/me')
  return unwrap(res.data)
}
