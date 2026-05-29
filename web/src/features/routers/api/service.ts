import { apiClient } from '@/lib/api/client'
import type { Envelope, MessageResult } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  CreateRouterRequest,
  RouterPublicView,
  UpdateRouterRequest,
} from './schema'

// Backend exposes MikroTik devices under `/devices`; the UI keeps the
// "router" vocabulary but talks to the devices endpoints.
const base = '/devices'

// GET /routers — admin-readable list of all configured routers. The
// backend background watcher updates `status` / `last_seen_at` every 10s.
export async function listRouters(): Promise<RouterPublicView[]> {
  const res = await apiClient.get<Envelope<RouterPublicView[]>>(base)
  return unwrap(res.data)
}

// GET /routers/:id — single router. The route is gated by the router-
// ownership middleware, but in this single-tenant build that just means
// "must exist and not be soft-deleted".
export async function getRouter(id: number): Promise<RouterPublicView> {
  const res = await apiClient.get<Envelope<RouterPublicView>>(`${base}/${id}`)
  return unwrap(res.data)
}

// POST /routers — backend tests the connection synchronously before
// persisting; failure here means "wrong creds or unreachable", not
// "server error". After save, the router is registered with the
// orchestrator engine so streaming workers start automatically.
export async function createRouter(
  body: CreateRouterRequest,
): Promise<RouterPublicView> {
  const res = await apiClient.post<Envelope<RouterPublicView>>(base, body)
  return unwrap(res.data)
}

// PUT /routers/:id — partial update. Re-tests the connection when any
// of {ip_address, api_port, api_username, password} change, and re-
// registers the orchestrator entry on success.
export async function updateRouter(
  id: number,
  body: UpdateRouterRequest,
): Promise<RouterPublicView> {
  const res = await apiClient.put<Envelope<RouterPublicView>>(
    `${base}/${id}`,
    body,
  )
  return unwrap(res.data)
}

// DELETE /devices/:id — delete the device. Subscriptions referencing it are
// handled server-side.
export async function deleteRouter(id: number): Promise<void> {
  await apiClient.delete<Envelope<MessageResult>>(`${base}/${id}`)
}
