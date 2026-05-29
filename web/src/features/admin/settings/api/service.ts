import { apiClient } from '@/lib/api/client'
import type { Envelope, MessageResult } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { Settings, UpdateSettingsRequest } from './schema'

const base = '/settings'

// GET /settings — admin-only (router wraps in RequireRole(admin)). Returns
// the singleton row; the backend auto-seeds a default row on first boot
// so this never 404s in a healthy deployment.
export async function getSettings(): Promise<Settings> {
  const res = await apiClient.get<Envelope<Settings>>(base)
  return unwrap(res.data)
}

// PUT /settings — partial update. See `UpdateSettingsRequest` docs:
// omitted fields are preserved, NOT cleared.
export async function updateSettings(
  body: UpdateSettingsRequest,
): Promise<Settings> {
  const res = await apiClient.put<Envelope<Settings>>(base, body)
  return unwrap(res.data)
}

// POST /settings/logo — multipart/form-data upload. The backend:
//   - requires the form field to be named `logo` exactly
//   - rejects files > 1 MB with a 400
//   - validates PNG/JPEG/WebP magic bytes (not just the extension)
//
// We let axios set the Content-Type header (including the multipart
// boundary) automatically by NOT setting it here — the default JSON
// header from `apiClient` is overridden when `FormData` is passed.
export async function uploadLogo(file: File): Promise<void> {
  const form = new FormData()
  form.append('logo', file)
  await apiClient.post<Envelope<MessageResult>>(`${base}/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// GET /settings/logo — returns the raw image file. We don't fetch it via
// axios; instead we return the absolute URL so the UI can drop it into
// an `<img src={url}>` and let the browser handle caching.
//
// Appends a cache-buster query string when requested so a successful
// `uploadLogo` can force a fresh fetch without a full page reload.
export function getLogoUrl(cacheBust?: string): string {
  const rawBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
  const url = `${rawBase.replace(/\/+$/, '')}/api/v1${base}/logo`
  return cacheBust ? `${url}?v=${encodeURIComponent(cacheBust)}` : url
}
