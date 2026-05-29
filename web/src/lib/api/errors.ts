import { isAxiosError } from 'axios'
import type { Envelope } from './types'

/**
 * Extract a human-readable message from any error returned by an axios call.
 *
 * Order of precedence:
 *   1. Backend envelope `data.error.message`
 *   2. AxiosError `error.message` (network / timeout / bad URL)
 *   3. Native `Error.message`
 *   4. Fallback `'Unknown error'`
 *
 * Use this in `onError` handlers and toast calls. For programmatic branching
 * on error type, use `getAPIErrorCode` instead.
 */
export function parseAPIError(error: unknown): string {
  if (isAxiosError(error)) {
    const env = error.response?.data as Envelope<unknown> | undefined
    if (env?.error?.message) return env.error.message
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

/**
 * Extract the stable `error.code` from a backend envelope, if present.
 * Returns `undefined` for network errors, non-axios errors, or successful
 * responses.
 *
 * Useful when the UI needs to react to a specific failure mode, e.g.:
 *   if (getAPIErrorCode(err) === 'tenant_suspended') redirectToBilling()
 */
export function getAPIErrorCode(error: unknown): string | undefined {
  if (isAxiosError(error)) {
    const env = error.response?.data as Envelope<unknown> | undefined
    return env?.error?.code
  }
  return undefined
}

/**
 * Extract the optional `error.details` payload from a backend envelope.
 * Returns `undefined` if absent.
 */
export function getAPIErrorDetails(error: unknown): unknown {
  if (isAxiosError(error)) {
    const env = error.response?.data as Envelope<unknown> | undefined
    return env?.error?.details
  }
  return undefined
}
