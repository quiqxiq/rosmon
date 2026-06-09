import { createFileRoute } from '@tanstack/react-router'
import { WhatsApp } from '@/features/whatsapp'

export const Route = createFileRoute('/_authenticated/admin/whatsapp/')({
  component: WhatsApp,
})
