import { createFileRoute } from '@tanstack/react-router'
import { AuditLogs } from '@/features/audit-logs'

export const Route = createFileRoute('/_authenticated/admin/audit-logs/')({
  component: AuditLogs,
})
