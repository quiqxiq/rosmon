import { z } from 'zod'

const userTypeSchema = z.union([z.literal('vc'), z.literal('up')])
export type UserType = z.infer<typeof userTypeSchema>

const charSetSchema = z.union([
  z.literal('lower'),
  z.literal('upper'),
  z.literal('mixed'),
  z.literal('number'),
  z.literal('lower_number'),
  z.literal('upper_number'),
  z.literal('mixed_number'),
])
export type CharSet = z.infer<typeof charSetSchema>

const dataLimitUnitSchema = z.union([z.literal('MB'), z.literal('GB')])
export type DataLimitUnit = z.infer<typeof dataLimitUnitSchema>

export const voucherGenerateFormSchema = z.object({
  qty: z.number().int().min(1).max(500),
  server: z.string(),
  profile: z.string(),
  userType: userTypeSchema,
  nameLength: z.number().int().min(4).max(32),
  charSet: charSetSchema,
  prefix: z.string(),
  timeLimit: z.string(),
  dataLimit: z.number().int().min(0),
  dataLimitUnit: dataLimitUnitSchema,
  comment: z.string(),
})
export type VoucherGenerateForm = z.infer<typeof voucherGenerateFormSchema>

export const generatedVoucherSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
  profile: z.string(),
  comment: z.string(),
})
export type GeneratedVoucher = z.infer<typeof generatedVoucherSchema>
