import type { AxiosError } from 'axios'
import type { ApiError } from '@/types/api'

export function extractApiError(error: unknown): ApiError {
  const axiosErr = error as AxiosError<{ error?: ApiError }>
  const apiErr = axiosErr?.response?.data?.error
  if (apiErr) return apiErr
  return {
    code: 'UNKNOWN',
    message: axiosErr?.message ?? 'Unknown error',
    requestId: (axiosErr?.response?.headers?.['x-request-id'] as string | undefined) ?? null,
  }
}
