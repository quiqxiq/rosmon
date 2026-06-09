import { Badge } from '@/components/ui/badge'
import type { InvoiceStatus } from '../api/schema'

const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  draft:     { label: 'Draft',      variant: 'secondary',    className: '' },
  issued:    { label: 'Belum Bayar', variant: 'outline',     className: 'border-blue-500 text-blue-600 dark:text-blue-400' },
  paid:      { label: 'Lunas',       variant: 'default',     className: 'bg-emerald-600 hover:bg-emerald-600' },
  overdue:   { label: 'Terlambat',   variant: 'destructive', className: '' },
  cancelled: { label: 'Dibatalkan',  variant: 'secondary',   className: 'opacity-60' },
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const { label, variant, className } = config[status] ?? { label: status, variant: 'secondary', className: '' }
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}

export function invoiceStatusLabel(status: InvoiceStatus | string): string {
  return config[status]?.label ?? status
}
