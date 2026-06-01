import type { InvoiceStatus, PaymentMethod, PaymentStatus, SubscriptionStatus } from './types'

// Badge variants available in this project: default, secondary, destructive,
// outline, online (green), expired (red), idle (amber), offline (gray)
export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'online' | 'expired' | 'idle' | 'offline'

interface StatusInfo {
  label: string
  variant: BadgeVariant
}

const invoiceStatusMap: Record<InvoiceStatus, StatusInfo> = {
  issued: { label: 'Belum Bayar', variant: 'idle' },
  overdue: { label: 'Terlambat', variant: 'expired' },
  paid: { label: 'Lunas', variant: 'online' },
  draft: { label: 'Draft', variant: 'offline' },
  cancelled: { label: 'Batal', variant: 'offline' },
}

const subStatusMap: Record<SubscriptionStatus, StatusInfo> = {
  active: { label: 'Aktif', variant: 'online' },
  isolir: { label: 'Terisolir', variant: 'idle' },
  suspended: { label: 'Diblokir', variant: 'expired' },
  pending_install: { label: 'Menunggu Pemasangan', variant: 'offline' },
  terminated: { label: 'Berhenti', variant: 'offline' },
}

const paymentStatusMap: Record<PaymentStatus, StatusInfo> = {
  pending: { label: 'Menunggu', variant: 'idle' },
  confirmed: { label: 'Terkonfirmasi', variant: 'online' },
  rejected: { label: 'Ditolak', variant: 'expired' },
}

const paymentMethodMap: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  manual_transfer: 'Transfer Manual',
  xendit: 'Transfer',
}

export function invoiceStatus(s: InvoiceStatus): StatusInfo {
  return invoiceStatusMap[s] ?? { label: s, variant: 'secondary' }
}

export function subStatus(s: SubscriptionStatus | string): StatusInfo {
  return subStatusMap[s as SubscriptionStatus] ?? { label: s, variant: 'secondary' }
}

export function paymentStatus(s: PaymentStatus | string): StatusInfo {
  return paymentStatusMap[s as PaymentStatus] ?? { label: s, variant: 'secondary' }
}

export function paymentMethod(m: PaymentMethod | string): string {
  return paymentMethodMap[m as PaymentMethod] ?? m
}

export function formatPeriod(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }
  const fmtS = new Intl.DateTimeFormat('id-ID', opts).format(s)
  const fmtE = new Intl.DateTimeFormat('id-ID', opts).format(e)
  return fmtS === fmtE ? fmtS : `${fmtS} – ${fmtE}`
}

export function formatIDDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(iso))
}

export function isDueSoon(dueDateIso: string): boolean {
  const now = new Date()
  const due = new Date(dueDateIso)
  const diffMs = due.getTime() - now.getTime()
  return diffMs > 0 && diffMs < 3 * 24 * 60 * 60 * 1000 // within 3 days
}
