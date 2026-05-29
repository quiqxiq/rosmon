import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type {
  PrintData,
  PrintVouchersRequest,
  RenderTemplateRequest,
} from './schema'

const voucherBase = (rid: number) => `/devices/${rid}/vouchers`

// GET /routers/:routerId/vouchers/print-data?gencode= — JSON envelope.
// Returns the cached voucher list for the batch + the tenant's hotspot
// settings so the print-render layer can build a page without a second
// round-trip for branding data.
export async function getPrintData(
  routerId: number,
  gencode: string,
): Promise<PrintData> {
  const res = await apiClient.get<Envelope<PrintData>>(
    `${voucherBase(routerId)}/print-data`,
    { params: { gencode } },
  )
  return unwrap(res.data)
}

// POST /routers/:routerId/vouchers/print — returns raw HTML (NOT an
// envelope). The backend sets `Content-Type: text/html; charset=utf-8`
// and writes the rendered page directly, so we request `responseType:
// 'text'` and return `res.data` as a plain string. Consumers typically
// drop this into an `<iframe srcdoc=...>` or open a print window.
export async function printVouchers(
  routerId: number,
  body: PrintVouchersRequest,
): Promise<string> {
  const res = await apiClient.post<string>(
    `${voucherBase(routerId)}/print`,
    body,
    { responseType: 'text' },
  )
  return res.data
}

// POST /templates/render — same HTML-response contract as `printVouchers`.
// This is the "render a specific (type, variant) preview" endpoint; the
// caller supplies the template_type plus arbitrary placeholder values.
// Not currently used by Phase 3 UI — exported for future preview wiring.
export async function renderTemplate(
  body: RenderTemplateRequest,
): Promise<string> {
  const res = await apiClient.post<string>('/templates/render', body, {
    responseType: 'text',
  })
  return res.data
}
