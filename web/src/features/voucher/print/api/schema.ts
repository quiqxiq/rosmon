import { z } from 'zod'

// Source: internal/api/handlers/quick_print_handler.go + internal/roskit/
// adapter/service/QuickPrintPackage.
//
// Important: every backend field is a STRING even for numeric-looking
// values (price, selling_price, user_length). That's because RouterOS
// stores these as free-form strings in `/system/script` and the bridge
// round-trips them untouched. We keep the same shape here so forms can
// write them back as-is.
export const QuickPrintPackageSchema = z.object({
  name: z.string().min(1).max(100),
  server: z.string().optional().default(''),
  user_mode: z.string().optional().default(''), // `vc` | `up`
  user_length: z.string().optional().default(''), // numeric-looking string
  prefix: z.string().optional().default(''),
  char_mode: z.string().optional().default(''), // lower/upper/mix/...
  profile: z.string().optional().default(''),
  time_limit: z.string().optional().default(''),
  data_limit: z.string().optional().default(''),
  comment: z.string().optional().default(''),
  validity: z.string().optional().default(''),
  price: z.string().optional().default(''),
  selling_price: z.string().optional().default(''),
  lock_user: z.string().optional().default(''), // '0' | '1'
})
export type QuickPrintPackage = z.infer<typeof QuickPrintPackageSchema>

// POST/PUT body — same shape as the read model. Backend's PUT is lenient
// (silently ignores bad body) so we don't gain much by narrowing the type.
export type QuickPrintPackageInput = QuickPrintPackage
