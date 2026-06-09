import { z } from 'zod'

// Request body untuk POST /devices/:id/hotspot/vouchers/generate.
// Field names dan binding tags mengikuti backend api/dto/voucher.go#VoucherGenerateRequest.
export const VoucherGenerateParamsSchema = z.object({
  batch_size: z.number().int().min(1).max(1000),
  server: z.string().max(64).optional(),
  user_mode: z.enum(['up', 'vc']).optional(),
  length: z.number().int().min(4).max(32),
  prefix: z.string().max(16).optional(),
  charset: z.string().max(64),
  profile: z.string().min(1).max(128),
  time_limit: z.string().max(64).optional(),
  data_limit: z.number().int().min(0).optional(),
  comment: z.string().max(128).optional(),
})
export type VoucherGenerateParams = z.infer<typeof VoucherGenerateParamsSchema>

// Response dari POST /devices/:id/hotspot/vouchers/generate.
// Mengikuti backend api/dto/voucher.go#VoucherGenerateResponse.
export const GeneratedVoucherSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
})
export type GeneratedVoucher = z.infer<typeof GeneratedVoucherSchema>

export const VoucherGenerateResultSchema = z.object({
  count: z.number().int(),
  gencode: z.string(),
  profile: z.string(),
  vouchers: z.array(GeneratedVoucherSchema),
})
export type VoucherGenerateResult = z.infer<typeof VoucherGenerateResultSchema>
