const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
}

export function parseValidityToMs(input: string): number {
  if (!input) return 0
  const regex = /(\d+)([smhdw])/g
  let total = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(input)) !== null) {
    const value = Number(match[1])
    const unit = match[2]
    total += value * (UNIT_TO_MS[unit] ?? 0)
  }
  return total
}

export function formatMsToValidity(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const d = Math.floor(ms / UNIT_TO_MS.d)
  const h = Math.floor((ms % UNIT_TO_MS.d) / UNIT_TO_MS.h)
  const m = Math.floor((ms % UNIT_TO_MS.h) / UNIT_TO_MS.m)
  const s = Math.floor((ms % UNIT_TO_MS.m) / UNIT_TO_MS.s)
  const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean)
  return parts.length ? parts.join('') : '0s'
}
