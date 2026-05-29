export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes < 1_099_511_627_776) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
  return `${(bytes / 1_099_511_627_776).toFixed(2)} TB`
}

export function formatBitsPerSecond(bps: number): string {
  if (bps < 1000) return `${bps} bps`
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(1)} Kbps`
  if (bps < 1_000_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  return `${(bps / 1_000_000_000).toFixed(2)} Gbps`
}

export function formatPacketsPerSecond(pps: number): string {
  if (pps < 1000) return `${pps} p/s`
  if (pps < 1_000_000) return `${(pps / 1000).toFixed(1)} Kp/s`
  return `${(pps / 1_000_000).toFixed(1)} Mp/s`
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMon = Math.round(diffDay / 30)
  if (diffMon < 12) return `${diffMon}mo ago`
  return `${Math.round(diffMon / 12)}y ago`
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}

export function formatDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m'
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = Math.floor(totalMinutes % 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date)
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', { timeStyle: 'medium' }).format(date)
}
