import { createFileRoute } from '@tanstack/react-router'
import { RoutersPage } from '@/features/routers'

export const Route = createFileRoute('/_authenticated/admin/routers/')({
  component: RoutersPage,
})
