import { useEffect, useRef, useState } from 'react'

export type PingStatus = 'excellent' | 'good' | 'high' | 'timeout'

export interface PingResult {
  ms: number | null
  status: PingStatus
}

function getStatus(ms: number | null): PingStatus {
  if (ms === null) return 'timeout'
  if (ms < 30) return 'excellent'
  if (ms < 80) return 'good'
  return 'high'
}

/**
 * Simulated ping hook — returns a ping result that updates every `intervalMs`.
 * Replace the TODO inside with a real API call (e.g. `fetch('/api/ping?host=...')`)
 * when integrating RouterOS.
 */
export function usePing(intervalMs = 2000): PingResult {
  const [result, setResult] = useState<PingResult>({
    ms: null,
    status: 'timeout',
  })
  const baseRef = useRef(18)

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      // TODO: replace with real API call
      // const { ms } = await fetch('/api/ping').then(r => r.json())
      await new Promise((r) => setTimeout(r, 200))
      if (cancelled) return

      // 4% chance of timeout
      if (Math.random() < 0.04) {
        setResult({ ms: null, status: 'timeout' })
        return
      }

      let ms = baseRef.current + (Math.random() - 0.4) * 12
      // 8% chance of spike
      if (Math.random() < 0.08) ms += 60 + Math.random() * 80
      ms = Math.max(1, Math.round(ms))

      setResult({ ms, status: getStatus(ms) })
      baseRef.current = Math.max(
        5,
        Math.min(40, baseRef.current + (Math.random() - 0.5) * 3)
      )
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return result
}
