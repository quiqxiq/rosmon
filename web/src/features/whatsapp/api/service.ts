import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  Setting,
  WhatsAppQR,
  WhatsAppStatus,
  WhatsAppTestInput,
} from './schema'

// ── WhatsApp gateway (whatsmeow embedded) ───────────────────────────────────

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await apiClient.get<Envelope<WhatsAppStatus>>('/whatsapp/status')
  return unwrap(res.data)
}

// GET /whatsapp/qr starts/continues pairing and returns the current QR string.
// Returns null when already connected (backend replies 409).
export async function getWhatsAppQR(): Promise<WhatsAppQR | null> {
  try {
    const res = await apiClient.get<Envelope<WhatsAppQR>>('/whatsapp/qr')
    return unwrap(res.data)
  } catch (err) {
    // 409 = already connected — not an error for the polling flow.
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 409) return null
    throw err
  }
}

export async function logoutWhatsApp(): Promise<void> {
  await apiClient.post<Envelope<WhatsAppStatus>>('/whatsapp/logout')
}

export async function sendWhatsAppTest(
  payload: WhatsAppTestInput,
): Promise<unknown> {
  const res = await apiClient.post<Envelope<{ provider_response: unknown }>>(
    '/whatsapp/test',
    payload,
  )
  return unwrap(res.data)
}

// ── Notification settings (key-value /settings) ─────────────────────────────

const NOTIF_PREFIX = 'notification.'

// Returns only the `notification.*` settings (wa_enabled, admin_phone).
export async function getNotificationSettings(): Promise<Setting[]> {
  const res = await apiClient.get<Envelope<Setting[]>>('/settings')
  const all = unwrap(res.data)
  return all.filter((s) => s.key.startsWith(NOTIF_PREFIX))
}

export async function updateSetting(
  key: string,
  value: string,
): Promise<void> {
  await apiClient.put<Envelope<{ key: string; value: string }>>(
    `/settings/${key}`,
    { value },
  )
}
