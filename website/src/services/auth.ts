import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { AuthUser, Credentials, TokenPair, Role } from '@/types/auth'

export const authService = {
  async login(credentials: Credentials): Promise<TokenPair> {
    const { data } = await http.post<ApiEnvelope<any>>('/auth/login', credentials)
    const raw = data.data
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
    }
  },
  async refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await http.post<ApiEnvelope<any>>('/auth/refresh', { refresh_token: refreshToken })
    const raw = data.data
    return {
      accessToken: raw.access_token,
      refreshToken: raw.refresh_token,
      expiresIn: raw.expires_in,
    }
  },
  async logout(refreshToken: string): Promise<void> {
    await http.post('/auth/logout', { refresh_token: refreshToken })
  },
  async me(): Promise<AuthUser> {
    const { data } = await http.get<ApiEnvelope<any>>('/auth/me')
    const raw = data.data
    return {
      id: String(raw.id),
      username: raw.username,
      role: raw.role as Role,
      createdAt: raw.created_at,
    }
  },
}
