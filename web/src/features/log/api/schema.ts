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

// REST GET /devices/:id/log — backlog buffer. Mirrors api/dto/log.go
// LogEntryResponse (topics = CSV string, time = RouterOS short format).
export const restLogEntrySchema = z.object({
  id: z.string(),
  time: z.string().optional(),
  topics: z.string().optional(),
  message: z.string(),
})
export type RestLogEntry = z.infer<typeof restLogEntrySchema>
