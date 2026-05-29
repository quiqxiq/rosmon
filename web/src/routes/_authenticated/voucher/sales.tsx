import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { VoucherSales } from '@/features/voucher/sales'

// URL search params for the sales page. All optional — the page falls
// back to "last 7 days, page 1, 25 per page, no filters" when params
// are missing or malformed. Keeping the schema permissive means a
// share-able URL doesn't 404 if it gets out of sync with the API.
const salesSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().optional(),
  profile: z.string().optional(),
  server: z.string().optional(),
})

export type VoucherSalesSearch = z.infer<typeof salesSearchSchema>

export const Route = createFileRoute('/_authenticated/voucher/sales')({
  component: VoucherSales,
  validateSearch: (search) => salesSearchSchema.parse(search),
})
