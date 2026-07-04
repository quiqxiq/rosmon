import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { NotifEventUpdateInput, WhatsAppTestInput, TelegramTestInput } from './schema'

// ── WhatsApp ──────────────────────────────────────────────────────────────

export function useWhatsAppStatus() {
  return useQuery({
    queryKey: qk.whatsappStatus(),
    queryFn: svc.getWhatsAppStatus,
    refetchInterval: 3000,
  })
}

export function useWhatsAppQR(enabled: boolean) {
  return useQuery({
    queryKey: qk.whatsappQR(),
    queryFn: svc.getWhatsAppQR,
    enabled,
    refetchInterval: enabled ? 20_000 : false,
    gcTime: 0,
  })
}

export function useLogoutWhatsApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: svc.logoutWhatsApp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  })
}

export function useWhatsAppContacts(enabled: boolean) {
  return useQuery({
    queryKey: qk.whatsappContacts(),
    queryFn: svc.getWhatsAppContacts,
    enabled,
    staleTime: 60_000,
  })
}

export function useWhatsAppGroups(enabled: boolean) {
  return useQuery({
    queryKey: qk.whatsappGroups(),
    queryFn: svc.getWhatsAppGroups,
    enabled,
    staleTime: 60_000,
  })
}

export function useSendWhatsAppTest() {
  return useMutation({
    mutationFn: (payload: WhatsAppTestInput) => svc.sendWhatsAppTest(payload),
  })
}

// ── Notification event routing ────────────────────────────────────────────

export function useNotifEvents() {
  return useQuery({
    queryKey: qk.notifEvents(),
    queryFn: svc.listNotifEvents,
  })
}

export function useUpdateNotifEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ event, payload }: { event: string; payload: NotifEventUpdateInput }) =>
      svc.updateNotifEvent(event, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifEvents() }),
  })
}

// ── Settings ──────────────────────────────────────────────────────────────

export function useNotifSettings() {
  return useQuery({
    queryKey: [...qk.settings(), 'notification-group'],
    queryFn: svc.getNotifSettings,
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => svc.updateSetting(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

// ── Telegram test ─────────────────────────────────────────────────────────

export function useSendTelegramTest() {
  return useMutation({
    mutationFn: (payload: TelegramTestInput) => svc.sendTelegramTest(payload),
  })
}
