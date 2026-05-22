import { http } from '@/plugins/axios'
import type { ApiEnvelope } from '@/types/api'
import type { AuthUser, Credentials, TokenPair } from '@/types/auth'

export const authService = {
  async login(credentials: Credentials): Promise<TokenPair> {
    const { data } = await http.post<ApiEnvelope<TokenPair>>('/auth/login', credentials)
    return data.data
  },
  async refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await http.post<ApiEnvelope<TokenPair>>('/auth/refresh', { refreshToken })
    return data.data
  },
  async logout(refreshToken: string): Promise<void> {
    await http.post('/auth/logout', { refreshToken })
  },
  async me(): Promise<AuthUser> {
    const { data } = await http.get<ApiEnvelope<AuthUser>>('/auth/me')
    return data.data
  },
}
