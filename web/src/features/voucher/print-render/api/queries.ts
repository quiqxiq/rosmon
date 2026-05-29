import { useMutation, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  PrintVouchersRequest,
  RenderTemplateRequest,
} from './schema'

// ─────────────────── Queries ───────────────────

// Fetch the cached print payload for a voucher batch. Gated on gencode
// presence so the print-render page can mount unconditionally and still
// skip the network call before the user has generated anything.
export function usePrintData(routerId: number, gencode: string) {
  return useQuery({
    queryKey: qk.voucherPrintData(routerId, gencode),
    queryFn: () => svc.getPrintData(routerId, gencode),
    enabled: routerId > 0 && gencode.length > 0,
  })
}

// ─────────────────── Mutations ───────────────────

// Render the official "bulk print" HTML page. The returned string is
// ready to drop into an `<iframe srcdoc=...>` or pass to `window.print`.
// Not cached — each render is cheap server-side and rarely repeated with
// identical args.
export function usePrintVouchers(routerId: number) {
  return useMutation<string, Error, PrintVouchersRequest>({
    mutationFn: (body) => svc.printVouchers(routerId, body),
  })
}

// Render a template preview. Useful for template-editor flows where the
// admin is previewing template_type without actually printing.
export function useRenderTemplate() {
  return useMutation<string, Error, RenderTemplateRequest>({
    mutationFn: (body) => svc.renderTemplate(body),
  })
}
