import { createFileRoute } from '@tanstack/react-router'
import { Log } from '@/features/log'

export const Route = createFileRoute('/_authenticated/log/')({
  component: Log,
})
