import { z } from 'zod'

const charSetSchema = z.union([
  z.literal('lower'),
  z.literal('upper'),
  z.literal('upplow'),
  z.literal('mix'),
  z.literal('mix1'),
  z.literal('mix2'),
  z.literal('num'),
])

const userModeSchema = z.union([z.literal('vc'), z.literal('up')])

const dataLimitUnitSchema = z.union([z.literal('MB'), z.literal('GB')])

const colorSchema = z.union([
  z.literal('blue'),
  z.literal('indigo'),
  z.literal('purple'),
  z.literal('pink'),
  z.literal('red'),
  z.literal('amber'),
  z.literal('green'),
  z.literal('teal'),
  z.literal('cyan'),
  z.literal('sky'),
])
export type PresetColor = z.infer<typeof colorSchema>

export const quickPrintPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  package: z.string(),
  server: z.string(),
  userMode: userModeSchema,
  userLength: z.number().int(),
  prefix: z.string(),
  charSet: charSetSchema,
  profile: z.string(),
  timeLimit: z.string(),
  dataLimit: z.number().int(),
  dataLimitUnit: dataLimitUnitSchema,
  validity: z.string(),
  price: z.number(),
  sellingPrice: z.number(),
  lockUser: z.boolean(),
  color: colorSchema,
})
export type QuickPrintPreset = z.infer<typeof quickPrintPresetSchema>
