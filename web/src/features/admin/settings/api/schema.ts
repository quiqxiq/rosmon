import { z } from 'zod'

// Source: internal/models/settings.go + internal/services/settings_service.go.
// Settings is a singleton row (id=1) — the "global application config".
// `webhook_token` is stripped server-side via `json:"-"` so it never
// reaches the frontend.

export const ReportModeSchema = z.enum(['enable', 'disable'])
export type ReportMode = z.infer<typeof ReportModeSchema>

export const SettingsSchema = z.object({
  id: z.number().int(),
  hotspot_name: z.string(),
  dns_name: z.string(),
  currency: z.string(),
  phone: z.string(),
  email: z.string(),
  info_lp: z.string(),
  idle_timeout: z.number().int(),
  report_mode: ReportModeSchema,
  logo_path: z.string(),
  timezone: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Settings = z.infer<typeof SettingsSchema>

// PUT /settings body — every field is optional. Backend's Update handler
// only applies non-empty strings / positive numbers, so omitted fields
// are preserved. `report_mode` must be exactly `enable` or `disable` when
// present (plain string allowed to be empty for "don't touch").
export const UpdateSettingsRequestSchema = z.object({
  hotspot_name: z.string().optional(),
  dns_name: z.string().optional(),
  currency: z.string().max(10).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  info_lp: z.string().optional(),
  idle_timeout: z.number().int().min(0).optional(),
  report_mode: ReportModeSchema.optional(),
  timezone: z.string().max(50).optional(),
})
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>
