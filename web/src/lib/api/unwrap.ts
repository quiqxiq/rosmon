import type { Envelope } from './types'

/**
 * Unwrap a backend `Envelope<T>` and throw if the server returned a
 * malformed payload (`data === null` while the HTTP status was 2xx,
 * which would be a backend bug).
 *
 * Axios already throws on non-2xx, so this only ever runs for successful
 * responses. The thrown error reuses `error.message` if present (e.g.
 * the backend returned a 200 with `{ data: null, error: {...} }`),
 * otherwise falls back to a generic message.
 *
 * Usage in `features/<domain>/api/service.ts`:
 *   const res = await apiClient.get<Envelope<Foo>>('/foo')
 *   return unwrap(res.data)
 */
export function unwrap<T>(env: Envelope<T>): T {
  if (env.data == null) {
    throw new Error(env.error?.message ?? 'Empty response payload')
  }
  return env.data
}
