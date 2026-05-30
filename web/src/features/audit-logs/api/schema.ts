import { z } from 'zod'

// dto.AuditLogResponse (api/dto/audit_log.go).
export const AuditLogSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable().optional(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.number().nullable().optional(),
  old_values: z.string().optional().default(''),
  new_values: z.string().optional().default(''),
  ip_address: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  created_at: z.string(),
})
export type AuditLog = z.infer<typeof AuditLogSchema>

export type AuditLogFilters = {
  entity_type?: string
  action?: string
  entity_id?: number
  user_id?: number
  limit?: number
}
