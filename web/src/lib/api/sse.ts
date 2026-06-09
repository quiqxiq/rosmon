import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'

// SSE connection status. Mirrors the natural EventSource lifecycle plus
// an `idle` state for "no URL provided yet".
export type SSEStatus = 'idle' | 'connecting' | 'open' | 'closed'

export type UseSSEResult = {
  status: SSEStatus
  error: Error | null
}

type UseSSEOptions = {
  // Override the auth token resolution. Defaults to reading from the
  // global auth store. Exposed for tests.
  getToken?: () => string
  // Cap on the exponential reconnect delay (ms). Default 30s.
  maxBackoffMs?: number
  // Named SSE event types to listen for, in addition to the default
  // (unnamed) `message` channel. The backend writes named frames
  // (`event: traffic`, `event: stats`, `event: log` …) which the default
  // `onmessage` handler does NOT receive per the SSE spec — so every
  // consumer of a named stream MUST pass the relevant name(s) here.
  events?: string[]
}

// `useSSE` opens an EventSource to `path` (relative to VITE_API_URL),
// JSON-parses each `data:` frame, and calls `onEvent`. Reconnects with
// exponential backoff on error. Cleans up on unmount or path change.
//
// `path` may be null to "park" the connection — useful when the
// `routerId` is not yet selected. The status flips to `idle` in that
// case and no EventSource is created.
//
// Auth token is appended as `?access_token=` query param because
// EventSource cannot send custom headers. The backend auth middleware
// reads `?access_token=<jwt>` as a fallback when no Authorization header
// is present.
export function useSSE<T = unknown>(
  path: string | null,
  onEvent: (data: T) => void,
  opts: UseSSEOptions = {},
): UseSSEResult {
  const [status, setStatus] = useState<SSEStatus>('idle')
  const [error, setError] = useState<Error | null>(null)

  // Stash the latest `onEvent` / `getToken` in refs so the effect
  // doesn't tear down and reconnect every render just because the
  // parent re-created the callback. Refs are updated inside an effect
  // (NOT during render) per React 19 purity rules.
  const onEventRef = useRef(onEvent)
  const getTokenRef = useRef(opts.getToken)
  const eventsRef = useRef(opts.events)
  useEffect(() => {
    onEventRef.current = onEvent
    getTokenRef.current = opts.getToken
    eventsRef.current = opts.events
  })

  const maxBackoffMs = opts.maxBackoffMs ?? 30_000

  useEffect(() => {
    if (!path) {
      // Parking the connection. Calling setState here is the documented
      // pattern for "sync external state into React" — this is exactly
      // the case the lint rule allows via callback subscriptions, but
      // the heuristic doesn't recognise this shape. The first setState
      // is enough to trip the rule for this effect, so a single
      // suppression covers both calls.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('idle')
      setError(null)
      return
    }

    let cancelled = false
    let attempt = 0
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const baseURL = (
      import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
    ).replace(/\/+$/, '')

    const connect = () => {
      if (cancelled) return
      const token =
        getTokenRef.current?.() ??
        useAuthStore.getState().auth.accessToken ??
        ''
      const sep = path.includes('?') ? '&' : '?'
      const url = `${baseURL}/api/v1${path}${sep}access_token=${encodeURIComponent(token)}`

      setStatus('connecting')
      es = new EventSource(url)

      es.onopen = () => {
        if (cancelled) return
        attempt = 0
        setStatus('open')
        setError(null)
      }

      // Shared frame handler for both the default `message` channel and
      // any named event channels declared via `opts.events`.
      const handle = (ev: MessageEvent) => {
        if (cancelled) return
        try {
          const parsed = JSON.parse(ev.data) as T
          onEventRef.current(parsed)
        } catch (err) {
          // Malformed frames are ignored — keep the stream alive rather
          // than tearing down on a single bad payload. Surface via
          // console in dev so the contract issue is visible.
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[useSSE] malformed event payload', err, ev.data)
          }
        }
      }

      es.onmessage = handle
      // Named events (`event: traffic|stats|log` …) are NOT delivered to
      // `onmessage`; register an explicit listener for each declared name.
      for (const name of eventsRef.current ?? []) {
        es.addEventListener(name, handle as EventListener)
      }

      es.onerror = () => {
        if (cancelled) return
        es?.close()
        es = null
        setStatus('closed')
        setError(new Error('SSE connection lost'))
        // Exponential backoff: 1s, 2s, 4s … capped at `maxBackoffMs`.
        const delay = Math.min(1000 * 2 ** attempt, maxBackoffMs)
        attempt += 1
        reconnectTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
      es = null
    }
  }, [path, maxBackoffMs])

  return { status, error }
}
