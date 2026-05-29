import { z } from 'zod'

// Source of truth: internal/services/voucher_service.go#/VoucherGenerateParams.
// Field names and bounds mirror the Go binding tags exactly so validation
// happens client-side before the round-trip.
export const VoucherGenerateParamsSchema = z.object({
  qty: z.number().int().min(1).max(1000),
  server: z.string().max(64).optional(),
  user_type: z.string().max(32).optional(), // `vc` (user==pass) or `up` (separate)
  name_length: z.number().int().min(3).max(32).optional(),
  prefix: z.string().max(16).optional(),
  char_set: z.string().max(64).optional(),
  profile: z.string().min(1).max(64),
  time_limit: z.string().max(64).optional(),
  data_limit: z.number().int().min(0).optional(),
  comment: z.string().max(200).optional(),
  gencode: z.string().max(64).optional(),
})
export type VoucherGenerateParams = z.infer<typeof VoucherGenerateParamsSchema>

// Source: internal/roskit/adapter/service/voucher.go#/GeneratedVoucher.
export const GeneratedVoucherSchema = z.object({
  username: z.string(),
  password: z.string(),
})
export type GeneratedVoucher = z.infer<typeof GeneratedVoucherSchema>

// Source: internal/services/voucher_service.go#/VoucherGenerateResult.
// Server returns `count`, the generated `gencode` (useful for the print
// flow), the resolved `profile` string, and the voucher list. Same shape
// is returned by POST /vouchers/cache when fetching a prior session.
export const VoucherGenerateResultSchema = z.object({
  count: z.number().int(),
  gencode: z.string(),
  profile: z.string(),
  vouchers: z.array(GeneratedVoucherSchema),
})
export type VoucherGenerateResult = z.infer<typeof VoucherGenerateResultSchema>
