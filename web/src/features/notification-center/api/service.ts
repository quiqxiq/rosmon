import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  NotifEventConfig,
  NotifEventUpdateInput,
  Setting,
  TelegramTestInput,
  WhatsAppContactItem,
  WhatsAppQR,
  WhatsAppStatus,
  WhatsAppTestInput,
} from './schema'

// ── WhatsApp ──────────────────────────────────────────────────────────────

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await apiClient.get<Envelope<WhatsAppStatus>>('/whatsapp/status')
  return unwrap(res.data)
}

export async function getWhatsAppQR(): Promise<WhatsAppQR | null> {
  try {
    const res = await apiClient.get<Envelope<WhatsAppQR>>('/whatsapp/qr')
    return unwrap(res.data)
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 409) return null
    throw err
  }
}

export async function logoutWhatsApp(): Promise<void> {
  await apiClient.post('/whatsapp/logout')
}

export async function getWhatsAppContacts(): Promise<WhatsAppContactItem[]> {
  const res = await apiClient.get<Envelope<WhatsAppContactItem[]>>('/whatsapp/contacts')
  return unwrap(res.data) ?? []
}

export async function getWhatsAppGroups(): Promise<WhatsAppContactItem[]> {
  const res = await apiClient.get<Envelope<WhatsAppContactItem[]>>('/whatsapp/groups')
  return unwrap(res.data) ?? []
}

export async function sendWhatsAppTest(payload: WhatsAppTestInput): Promise<unknown> {
  const res = await apiClient.post<Envelope<{ provider_response: unknown }>>('/whatsapp/test', payload)
  return unwrap(res.data)
}

// ── Notification event routing ────────────────────────────────────────────

export async function listNotifEvents(): Promise<NotifEventConfig[]> {
  const res = await apiClient.get<Envelope<NotifEventConfig[]>>('/notification-events')
  return unwrap(res.data) ?? []
}

export async function updateNotifEvent(event: string, payload: NotifEventUpdateInput): Promise<void> {
  await apiClient.put(`/notification-events/${event}`, payload)
}

// ── Settings (notification group) ────────────────────────────────────────

export async function getNotifSettings(): Promise<Setting[]> {
  const res = await apiClient.get<Envelope<Setting[]>>('/settings')
  const all = unwrap(res.data) ?? []
  return all.filter(
    (s) => s.key.startsWith('notification.') && !s.key.startsWith('notification.event.'),
  )
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await apiClient.put<Envelope<{ key: string; value: string }>>(`/settings/${key}`, { value })
}

// ── Telegram test ─────────────────────────────────────────────────────────

export async function sendTelegramTest(payload: TelegramTestInput): Promise<unknown> {
  const res = await apiClient.post<Envelope<{ provider_response: unknown }>>('/telegram/test', payload)
  return unwrap(res.data)
}
