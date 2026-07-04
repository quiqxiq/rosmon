import { createFileRoute } from '@tanstack/react-router'
import { TabWhatsApp } from '@/features/notification-center/tab-whatsapp'

export const Route = createFileRoute('/_authenticated/settings/whatsapp')({
  component: TabWhatsApp,
})
