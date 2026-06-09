import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { WhatsAppTestInput } from './schema'

// Status poll — refetch every 3s so the QR screen flips to "connected"
// shortly after the phone scans.
export function useWhatsAppStatus() {
  return useQuery({
    queryKey: qk.whatsappStatus(),
    queryFn: svc.getWhatsAppStatus,
    refetchInterval: 3000,
  })
}

// QR query — only enabled while the admin is actively pairing and not yet
// connected. whatsmeow rotates the code, so re-fetch every 20s.
export function useWhatsAppQR(enabled: boolean) {
  return useQuery({
    queryKey: qk.whatsappQR(),
    queryFn: svc.getWhatsAppQR,
    enabled,
    refetchInterval: enabled ? 20000 : false,
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

export function useSendWhatsAppTest() {
  return useMutation({
    mutationFn: (payload: WhatsAppTestInput) => svc.sendWhatsAppTest(payload),
  })
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: svc.getNotificationSettings,
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      svc.updateSetting(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
