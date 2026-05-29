import { type LogEvent } from '../api/schema'
import { type LogEntry } from './schema'

export const LOG_MAX_ENTRIES = 500

export const TOPIC_COLORS: Record<string, string> = {
  hotspot: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  info: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  debug: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'bg-red-500/10 text-red-700 dark:text-red-400',
  system: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  firewall: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  wireless: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  dhcp: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  pppoe: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400',
}

export function topicColor(topic: string): string {
  return TOPIC_COLORS[topic] ?? 'bg-muted text-muted-foreground'
}

export function filterLogs(
  entries: LogEntry[],
  search: string,
  selectedTopics: string[]
): LogEntry[] {
  const term = search.trim().toLowerCase()
  return entries.filter((e) => {
    if (
      selectedTopics.length > 0 &&
      !e.topics.some((t) => selectedTopics.includes(t))
    ) {
      return false
    }
    if (term && !e.message.toLowerCase().includes(term)) return false
    return true
  })
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function parseLogTime(timeStr: string): Date {
  const iso = new Date(timeStr)
  if (!isNaN(iso.getTime())) return iso
  // RouterOS short format: "apr/30 10:11:12"
  const [datePart, timePart] = timeStr.split(' ')
  const [monthStr, dayStr] = (datePart ?? '').split('/')
  const [h, m, s] = (timePart ?? '').split(':').map(Number)
  const month = MONTHS[monthStr?.toLowerCase() ?? ''] ?? 0
  const d = new Date(
    new Date().getFullYear(),
    month,
    +dayStr,
    h || 0,
    m || 0,
    s || 0
  )
  if (d.getTime() - Date.now() > 86_400_000) d.setFullYear(d.getFullYear() - 1)
  return d
}

let _id = 0

export function sseLogToLogEntry(event: LogEvent): LogEntry {
  const fields = event.fields // ← tambah ini
  return {
    id: `sse-${++_id}`,
    time: parseLogTime(fields.time),
    topics: fields.topics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    message: fields.message,
  }
}