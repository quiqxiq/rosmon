import { apiClient } from '@/lib/api/client'
import type { Envelope, MessageResult } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  AdminUser,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from './schema'

const base = '/auth/users'

// GET /auth/users — admin-only (router.go wraps this group in RequireRole(admin)).
// Backend returns the list unsorted; callers sort in-memory if they need a
// specific order.
export async function listAdminUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<Envelope<AdminUser[]>>(base)
  return unwrap(res.data)
}

// GET /users/:id — single user by DB id. Returns 404 when missing (not
// when soft-deleted — deleted rows are hidden by the GORM SoftDelete).
export async function getAdminUser(id: number): Promise<AdminUser> {
  const res = await apiClient.get<Envelope<AdminUser>>(`${base}/${id}`)
  return unwrap(res.data)
}

// POST /users — create a new user. Returns 409 on duplicate username,
// 400 on invalid role. Password is not hashed client-side; backend uses
// bcrypt with the default cost.
export async function createAdminUser(
  body: CreateAdminUserRequest,
): Promise<AdminUser> {
  const res = await apiClient.post<Envelope<AdminUser>>(base, body)
  return unwrap(res.data)
}

// PUT /users/:id — partial update. Only fields present in `body` are
// applied; omit a field to leave it untouched (not to clear it).
export async function updateAdminUser(
  id: number,
  body: UpdateAdminUserRequest,
): Promise<AdminUser> {
  const res = await apiClient.put<Envelope<AdminUser>>(`${base}/${id}`, body)
  return unwrap(res.data)
}

// DELETE /users/:id — soft delete. The row stays in the DB with
// `deleted_at = now()` and is hidden from future reads. The username
// becomes re-usable because the unique index is partial on
// `WHERE deleted_at IS NULL`.
export async function deleteAdminUser(id: number): Promise<void> {
  await apiClient.delete<Envelope<MessageResult>>(`${base}/${id}`)
}

export async function batchDeleteAdminUsers(ids: number[]): Promise<number> {
  const res = await apiClient.post<Envelope<{ deleted: number }>>(`${base}/batch-delete`, { ids })
  return unwrap(res.data).deleted
}
