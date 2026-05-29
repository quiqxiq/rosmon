import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { Settings, UpdateSettingsRequest } from './schema'

// ─────────────────── Queries ───────────────────

// Singleton query — there is only ever one settings row. Cached
// indefinitely until a mutation invalidates it.
export function useSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: () => svc.getSettings(),
  })
}

// ─────────────────── Mutations ───────────────────

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation<Settings, Error, UpdateSettingsRequest>({
    mutationFn: (body) => svc.updateSettings(body),
    onSuccess: (data) => {
      // Seed the cache with the fresh server response so consumers
      // skip a re-fetch on the next render.
      qc.setQueryData(qk.settings(), data)
    },
  })
}

export function useUploadLogo() {
  const qc = useQueryClient()
  return useMutation<void, Error, File>({
    mutationFn: (file) => svc.uploadLogo(file),
    onSuccess: () => {
      // Logo path on the settings row may change; refresh to grab the
      // new `logo_path`. Also bust any keyed-by-url image queries.
      qc.invalidateQueries({ queryKey: qk.settings() })
      qc.invalidateQueries({ queryKey: qk.settingsLogo() })
    },
  })
}
