import { z } from 'zod'

// dto.IPPoolResponse
export const IPPoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  ranges: z.string().optional(),
  total: z.number(),
  used: z.number(),
  available: z.number(),
  next_pool: z.string().optional(),
  comment: z.string().optional(),
})
export type IPPool = z.infer<typeof IPPoolSchema>

export type IPPoolCreateInput = {
  name: string
  ranges: string
  next_pool?: string
  comment?: string
}

// dto.QueueSimpleResponse (subset of commonly-shown fields).
export const SimpleQueueSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    target: z.string().optional(),
    max_limit: z.string().optional(),
    burst_limit: z.string().optional(),
    parent: z.string().optional(),
    disabled: z.boolean(),
    dynamic: z.boolean(),
    comment: z.string().optional(),
  })
  .passthrough()
export type SimpleQueue = z.infer<typeof SimpleQueueSchema>

// dto.DHCPLeaseResponse
export const DHCPLeaseSchema = z
  .object({
    id: z.string(),
    address: z.string().optional(),
    mac_address: z.string().optional(),
    host_name: z.string().optional(),
    server: z.string().optional(),
    status: z.string().optional(),
    expires_after: z.string().optional(),
    dynamic: z.boolean(),
    disabled: z.boolean(),
    comment: z.string().optional(),
  })
  .passthrough()
export type DHCPLease = z.infer<typeof DHCPLeaseSchema>

// dto.ARPEntryResponse
export const ARPEntrySchema = z
  .object({
    id: z.string(),
    address: z.string().optional(),
    mac_address: z.string().optional(),
    interface: z.string().optional(),
    dynamic: z.boolean(),
    disabled: z.boolean(),
    complete: z.boolean(),
    comment: z.string().optional(),
  })
  .passthrough()
export type ARPEntry = z.infer<typeof ARPEntrySchema>
