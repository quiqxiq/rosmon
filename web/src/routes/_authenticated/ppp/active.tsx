import { createFileRoute } from '@tanstack/react-router'
import { PPPActive } from '@/features/ppp/active'

export const Route = createFileRoute('/_authenticated/ppp/active')({
  component: PPPActive,
})
