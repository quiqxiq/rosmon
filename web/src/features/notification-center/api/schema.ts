import { z } from 'zod'

// ── WhatsApp ──────────────────────────────────────────────────────────────

export const WhatsAppStatusSchema = z.object({
  connected: z.boolean(),
  jid: z.string().optional().default(''),
})
export type WhatsAppStatus = z.infer<typeof WhatsAppStatusSchema>

export const WhatsAppQRSchema = z.object({ code: z.string() })
export type WhatsAppQR = z.infer<typeof WhatsAppQRSchema>

export type WhatsAppContactItem = {
  jid: string
  name: string
  type: 'contact' | 'group'
}

export type WhatsAppTestInput = {
  phone: string   // JID atau nomor, diisi oleh user
  message: string
}

// ── Notification event routing ────────────────────────────────────────────

export type NotifEventConfig = {
  event: string
  label: string
  description: string
  targets: string[] // ["wa_admin","wa_group:xxx@g.us","tg_admin"]
}

export type NotifEventUpdateInput = {
  targets: string[]
}

// Parsed token structure for the UI.
export type TargetToken =
  | { kind: 'wa_admin' }
  | { kind: 'tg_admin' }
  | { kind: 'wa_group'; jid: string }
  | { kind: 'wa_number'; phone: string }

export function parseToken(t: string): TargetToken {
  if (t === 'wa_admin') return { kind: 'wa_admin' }
  if (t === 'tg_admin') return { kind: 'tg_admin' }
  if (t.startsWith('wa_group:')) return { kind: 'wa_group', jid: t.slice(9) }
  if (t.startsWith('wa_number:')) return { kind: 'wa_number', phone: t.slice(10) }
  return { kind: 'wa_admin' }
}

export function tokenToString(t: TargetToken): string {
  if (t.kind === 'wa_admin') return 'wa_admin'
  if (t.kind === 'tg_admin') return 'tg_admin'
  if (t.kind === 'wa_group') return `wa_group:${t.jid}`
  if (t.kind === 'wa_number') return `wa_number:${t.phone}`
  return ''
}

export function tokenLabel(t: TargetToken, groups: WhatsAppContactItem[]): string {
  if (t.kind === 'wa_admin') return 'Admin WA'
  if (t.kind === 'tg_admin') return 'Admin Telegram'
  if (t.kind === 'wa_group') {
    const g = groups.find((x) => x.jid === t.jid)
    return g ? `Grup: ${g.name}` : `Grup: ${t.jid}`
  }
  if (t.kind === 'wa_number') return `Nomor: ${t.phone}`
  return ''
}

// ── Settings (key-value dari /settings) ──────────────────────────────────

export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  value_type: z.string(),
  description: z.string().optional().default(''),
  group_name: z.string().optional().default(''),
})
export type Setting = z.infer<typeof SettingSchema>

// ── Telegram test ─────────────────────────────────────────────────────────
export type TelegramTestInput = { message: string }
