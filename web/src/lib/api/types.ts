// Shared API response types.
//
// Source of truth: docs/openapi/components/schemas/common.yaml
// Backend implementation: pkg/httpresp/respond.go

/**
 * Stable error envelope returned by the backend on every failure.
 * `code` is a machine-readable identifier (e.g. `invalid_input`).
 * `message` is human-readable English suitable for direct display.
 * `details` is an optional structured payload (e.g. per-field errors).
 */
export type APIError = {
  code: string
  message: string
  details?: unknown
}

/**
 * List metadata returned alongside array payloads: `{ data: [...], meta: { count } }`.
 * The backend does not paginate server-side — lists come back whole and the
 * data-table paginates on the client.
 */
export type ListMeta = {
  count: number
}

/**
 * Universal response shape. On success `data` is non-null (and `meta` may be
 * present for list endpoints); on failure `error` is non-null.
 */
export type Envelope<T> = {
  data: T | null
  error: APIError | null
  meta?: ListMeta | null
}

/**
 * Generic count-style response: `GET .../count` returns `{ count }`.
 */
export type CountResponse = { count: number }

/**
 * Shape of POST add-style responses: `{ data: { id }, error: null }`.
 * Used by RouterOS-backed endpoints that return only the new RouterOS
 * `.id` (e.g. `*42`) on creation.
 */
export type AddResult = { id: string }

/**
 * Shape of mutation responses that return only a status message:
 * `{ data: { message }, error: null }`.
 */
export type MessageResult = { message: string }

/**
 * Raw RouterOS sentence record. Most hotspot/ppp/network endpoints return
 * arrays of these — a `name → value` map keyed by hyphenated MikroTik
 * field names (e.g. `mac-address`, `bytes-in`). The `.id` field is always
 * present and starts with `*` (e.g. `*A1`).
 *
 * Keep as `Record<string, string>` because the underlying RouterOS API is
 * untyped and can return arbitrary keys depending on RouterOS version.
 * Per-domain Zod schemas in `features/<domain>/api/schema.ts` document the
 * common keys via `.passthrough()` for forward compatibility.
 */
export type RouterOSRecord = Record<string, string>
