import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DailyReport } from '@/features/report/daily'

const dailySearchSchema = z.object({
  date: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/report/daily')({
  component: DailyReport,
  validateSearch: (search) => dailySearchSchema.parse(search),
})
