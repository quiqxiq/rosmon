import { z } from 'zod'

// Mirror of dto.PPPActiveResponse (api/dto/ppp.go).
export const PPPActiveSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    service: z.string().optional(),
    caller_id: z.string().optional(),
    address: z.string().optional(),
    uptime: z.string().optional(),
    limit_bytes_in: z.number().optional(),
    limit_bytes_out: z.number().optional(),
    comment: z.string().optional(),
  })
  .passthrough()
export type PPPActive = z.infer<typeof PPPActiveSchema>
