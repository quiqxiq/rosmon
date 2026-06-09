import { z } from 'zod'

// Source of truth: service/auth/errors.go (RBAC 3-role: admin > operator >
// viewer) + service/auth/service.go. The JWT access token carries `rol`.

export const UserRoleSchema = z.enum(['admin', 'operator', 'viewer'])
export type UserRoleT = z.infer<typeof UserRoleSchema>

// Mirror of services.UserView — the shape returned by /auth/me and
// embedded in LoginResult.user.
export const UserViewSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  role: UserRoleSchema,
})
export type UserView = z.infer<typeof UserViewSchema>

// ─────────────────── Login ───────────────────

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
})
export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const LoginResultSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  // Lifetime of the access token in seconds (e.g. 900 = 15min).
  expires_in: z.number().int(),
  user: UserViewSchema,
})
export type LoginResult = z.infer<typeof LoginResultSchema>

// ─────────────────── Refresh ───────────────────

export const RefreshRequestSchema = z.object({
  refresh_token: z.string().min(10).max(4096),
})
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>

// ─────────────────── Logout ───────────────────

export const LogoutRequestSchema = z.object({
  refresh_token: z.string().max(4096).optional(),
})
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>

