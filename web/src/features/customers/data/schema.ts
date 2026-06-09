import { z } from 'zod'
import { type Customer, type CustomerStatus } from '../api/schema'

export const customerStatusSchema = z.union([
  z.literal('aktif'),
  z.literal('nonaktif'),
])

export type { Customer, CustomerStatus }
