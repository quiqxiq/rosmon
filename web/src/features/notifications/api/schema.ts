import { z } from 'zod'

// dto.NotificationLogResponse (api/dto/notification.go).
export const NotificationLogSchema = z.object({
  id: z.number(),
  customer_id: z.number().nullable().optional(),
  template_slug: z.string(),
  recipient_phone: z.string(),
  message_body: z.string(),
  status: z.string(), // pending | sent | failed
  provider: z.string().optional().default(''),
  retry_count: z.number(),
  sent_at: z.string().nullable().optional(),
  next_retry_at: z.string().nullable().optional(),
  created_at: z.string(),
})
export type NotificationLog = z.infer<typeof NotificationLogSchema>

export type NotificationLogFilters = {
  status?: string
  template_slug?: string
  customer_id?: number
  limit?: number
}
