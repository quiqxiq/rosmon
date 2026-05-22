export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${units[i]}`
}

export function formatRate(bitsPerSecond: number): string {
  return `${formatBytes(bitsPerSecond / 8)}/s`
}

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ')
}

export function formatDate(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input)
  return d.toLocaleString()
}
