import { z } from 'zod'

// Source: internal/api/handlers/voucher_handler.go#/PrintData (inline).
// Returned by GET /routers/:routerId/vouchers/print-data?gencode=. The
// `router_info` block packs settings (hotspot name, currency, etc.) so
// the print-render UI can format vouchers without an extra settings read.
export const GeneratedVoucherSchema = z.object({
  username: z.string(),
  password: z.string(),
})
export type GeneratedVoucher = z.infer<typeof GeneratedVoucherSchema>

export const PrintRouterInfoSchema = z.object({
  hotspot_name: z.string(),
  dns_name: z.string(),
  currency: z.string(),
  phone: z.string(),
  email: z.string(),
  info_lp: z.string(),
})
export type PrintRouterInfo = z.infer<typeof PrintRouterInfoSchema>

export const PrintDataSchema = z.object({
  vouchers: z.array(GeneratedVoucherSchema),
  router_info: PrintRouterInfoSchema,
})
export type PrintData = z.infer<typeof PrintDataSchema>

// Body for POST /routers/:routerId/vouchers/print. Either `usernames` or
// `comment` is required (backend returns 400 otherwise). `template_type`
// defaults to `default` when omitted.
export const PrintVouchersRequestSchema = z.object({
  usernames: z.array(z.string().min(1).max(64)).max(500).optional(),
  comment: z.string().max(200).optional(),
  template_type: z.enum(['default', 'small', 'thermal']).optional(),
})
export type PrintVouchersRequest = z.infer<typeof PrintVouchersRequestSchema>

// Body for POST /templates/render. All metadata fields are optional —
// the template engine substitutes empty strings when a placeholder is
// missing. `router_id` + `gencode` are the session identifiers.
export const RenderTemplateRequestSchema = z.object({
  router_id: z.number().int().min(1),
  gencode: z.string().min(4).max(64),
  template_type: z.enum(['default', 'small', 'thermal']),
  profile: z.string().max(64).optional(),
  validity: z.string().max(64).optional(),
  time_limit: z.string().max(64).optional(),
  data_limit: z.string().max(64).optional(),
  price: z.string().max(64).optional(),
  comment: z.string().max(200).optional(),
  user_mode: z.string().max(32).optional(),
  logo: z.string().max(255).optional(),
})
export type RenderTemplateRequest = z.infer<typeof RenderTemplateRequestSchema>
