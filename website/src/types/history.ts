export interface HistoryQuery {
  measurement: string
  start: string
  stop?: string
  windowMs?: number
  filter?: Record<string, string>
}

export interface HistoryPoint {
  timestamp: string
  value: number
  tags?: Record<string, string>
}

export interface HistorySeries {
  measurement: string
  field: string
  points: HistoryPoint[]
}
