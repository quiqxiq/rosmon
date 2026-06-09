import { Badge } from '@/components/ui/badge'

const config: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pending',       className: 'border-amber-500 text-amber-600 dark:text-amber-400' },
  confirmed: { label: 'Dikonfirmasi',  className: 'bg-emerald-600 hover:bg-emerald-600 text-white border-transparent' },
  rejected:  { label: 'Ditolak',       className: 'bg-destructive/10 text-destructive border-destructive/30' },
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const { label, className } = config[status] ?? { label: status, className: '' }
  return (
    <Badge variant='outline' className={className}>
      {label}
    </Badge>
  )
}
