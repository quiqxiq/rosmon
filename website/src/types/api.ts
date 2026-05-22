export interface ApiEnvelope<T> {
  data: T
}

export interface ApiError {
  code: string
  message: string
  requestId?: string | null
  details?: Record<string, unknown>
}

export interface ApiErrorEnvelope {
  error: ApiError
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}
