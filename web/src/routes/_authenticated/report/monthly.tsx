import { createFileRoute } from '@tanstack/react-router'
import { MonthlyReport } from '@/features/report/monthly'

export const Route = createFileRoute('/_authenticated/report/monthly')({
  component: MonthlyReport,
})
