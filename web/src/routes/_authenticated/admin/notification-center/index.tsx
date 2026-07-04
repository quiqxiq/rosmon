import { createFileRoute } from '@tanstack/react-router'
import { NotificationCenter } from '@/features/notification-center'

export const Route = createFileRoute('/_authenticated/admin/notification-center/')({
  component: NotificationCenter,
})
