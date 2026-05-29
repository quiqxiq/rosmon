import { z } from 'zod'

// Source: internal/models/user.go + internal/api/handlers/user_handler.go.
// NOT related to features/users/data/schema.ts — that's the demo shadcn-
// admin CRUD (cashier/manager roles etc.) and remains untouched per Phase
// 3 "Coexist" decision.
//
// Backend enforces `role IN ('admin','staff')` with a DB constraint, so
// these two literals are authoritative.

export const AdminUserRoleSchema = z.enum(['admin', 'staff'])
export type AdminUserRole = z.infer<typeof AdminUserRoleSchema>

export const AdminUserSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  role: AdminUserRoleSchema,
  active: z.boolean(),
  last_login_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type AdminUser = z.infer<typeof AdminUserSchema>

// POST /users body — password is required on create, can't be fetched back.
export const CreateAdminUserRequestSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(6).max(128),
  role: AdminUserRoleSchema,
})
export type CreateAdminUserRequest = z.infer<typeof CreateAdminUserRequestSchema>

// PUT /users/:id body — every field optional (partial update). Handler
// explicitly reads `*string` / `*bool` pointers so `undefined` = "don't
// touch", not "clear".
export const UpdateAdminUserRequestSchema = z.object({
  username: z.string().min(3).max(64).optional(),
  password: z.string().min(6).max(128).optional(),
  role: AdminUserRoleSchema.optional(),
  active: z.boolean().optional(),
})
export type UpdateAdminUserRequest = z.infer<typeof UpdateAdminUserRequestSchema>
