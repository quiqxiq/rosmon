import { z } from 'zod'

// dto.WhatsAppStatusResponse / WhatsAppQRResponse (api/dto/whatsapp.go).
export const WhatsAppStatusSchema = z.object({
  connected: z.boolean(),
  jid: z.string().optional().default(''),
})
export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>

export const WhatsAppQRSchema = z.object({
  code: z.string(),
})
export type WhatsAppQR = z.infer<typeof WhatsAppQRSchema>

export type WhatsAppTestInput = {
  phone: string
  message: string
}

// Key-value system_settings row (api/handler/settings.go).
export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  value_type: z.string(),
  description: z.string().optional().default(''),
  group_name: z.string().optional().default(''),
})
export type Setting = z.infer<typeof SettingSchema>
