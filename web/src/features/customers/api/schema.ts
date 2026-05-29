import { z } from 'zod'

// dto.CustomerResponse
export const CustomerSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  phone: z.string(),
  address: z.string(),
  area: z.string(),
  notes: z.string(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Customer = z.infer<typeof CustomerSchema>

export type CustomerStatus = 'aktif' | 'nonaktif'

export type CustomerCreateInput = {
  full_name: string
  phone: string
  address?: string
  area?: string
  notes?: string
  status?: CustomerStatus
}

export type CustomerUpdateInput = Partial<CustomerCreateInput>

export type CustomerListFilters = {
  status?: string
  area?: string
  q?: string
}
