import { createFileRoute } from '@tanstack/react-router'
import { TabTelegram } from '@/features/notification-center/tab-telegram'

export const Route = createFileRoute('/_authenticated/settings/telegram')({
  component: TabTelegram,
})
