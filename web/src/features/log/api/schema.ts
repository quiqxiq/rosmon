import { z } from 'zod'

export const logEventSchema = z.object({
  router_id: z.string(),
  measurement: z.string(),
  type: z.string(),
  timestamp: z.string(),
  fields: z.object({
    message: z.string(),
    topics: z.string(),
    time: z.string(),
    filter: z.string(),
  }),
})

export type LogEvent = z.infer<typeof logEventSchema>
