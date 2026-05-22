export type Role = 'admin' | 'operator' | 'viewer'

export interface Credentials {
  username: string
  password: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface AuthUser {
  id: string
  username: string
  role: Role
  createdAt: string
}
