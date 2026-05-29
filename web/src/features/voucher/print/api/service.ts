import { apiClient } from '@/lib/api/client'
import type { Envelope, MessageResult } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { QuickPrintPackage, QuickPrintPackageInput } from './schema'

const base = (rid: number) => `/devices/${rid}/quick-print`

// GET /routers/:routerId/quick-print — list all saved packages for this
// router. Backend normalizes a nil list to `[]` so the envelope never
// contains null here.
export async function listQuickPrintPackages(
  routerId: number,
): Promise<QuickPrintPackage[]> {
  const res = await apiClient.get<Envelope<QuickPrintPackage[]>>(base(routerId))
  return unwrap(res.data)
}

// GET /routers/:routerId/quick-print/:name — single package. Returns
// 404 when the name doesn't exist on this router.
export async function getQuickPrintPackage(
  routerId: number,
  name: string,
): Promise<QuickPrintPackage> {
  const res = await apiClient.get<Envelope<QuickPrintPackage>>(
    `${base(routerId)}/${encodeURIComponent(name)}`,
  )
  return unwrap(res.data)
}

// POST /routers/:routerId/quick-print — create. Backend only validates
// that `name` is non-empty; the rest of the fields flow through as-is.
// Response is a `{ message }` envelope; callers typically don't need it.
export async function createQuickPrintPackage(
  routerId: number,
  body: QuickPrintPackageInput,
): Promise<void> {
  await apiClient.post<Envelope<MessageResult>>(base(routerId), body)
}

// PUT /routers/:routerId/quick-print/:name — update. Backend matches on
// the path segment, NOT `body.name`, so callers can use PUT to rename
// by passing a different `body.name`.
export async function updateQuickPrintPackage(
  routerId: number,
  name: string,
  body: QuickPrintPackageInput,
): Promise<void> {
  await apiClient.put<Envelope<MessageResult>>(
    `${base(routerId)}/${encodeURIComponent(name)}`,
    body,
  )
}

// DELETE /routers/:routerId/quick-print/:name — hard delete. Safe to call
// for missing names; backend returns 400 with a specific error message.
export async function removeQuickPrintPackage(
  routerId: number,
  name: string,
): Promise<void> {
  await apiClient.delete<Envelope<MessageResult>>(
    `${base(routerId)}/${encodeURIComponent(name)}`,
  )
}
