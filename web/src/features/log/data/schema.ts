import { z } from 'zod'

export const LOG_TOPICS = [
  'hotspot',
  'info',
  'debug',
  'warning',
  'error',
  'system',
  'firewall',
  'wireless',
  'dhcp',
  'pppoe',
] as const

export type LogTopic = (typeof LOG_TOPICS)[number]

export const logEntrySchema = z.object({
  id: z.string(),
  time: z.coerce.date(),
  topics: z.array(z.string()),
  message: z.string(),
})
export type LogEntry = z.infer<typeof logEntrySchema>
